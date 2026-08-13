import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCorrelationReport,
  type CorrelationReportResponse,
  type GroundedCorrelation,
} from '../lib/api-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useCorrelationReport(projectId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery<CorrelationReportResponse, Error>({
    queryKey: ['correlation-report', projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return getCorrelationReport(projectId, getToken);
    },
    enabled: Boolean(isLoaded && isSignedIn && projectId),
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useRunCorrelationStream(projectId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [isStreaming, setIsStreaming] = useState(false);
  const [stage, setStage] = useState<string>('idle');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [discoveredCorrelations, setDiscoveredCorrelations] = useState<GroundedCorrelation[]>([]);

  const activeEventSourceRef = useRef<EventSource | null>(null);

  const stopStream = useCallback(() => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const startStream = useCallback(
    async (customQuery?: string) => {
      if (!projectId) return;

      stopStream();
      setIsStreaming(true);
      setStage('connecting');
      setProgressMessage('Connecting to Correlation Engine stream...');
      setStreamError(null);
      setDiscoveredCorrelations([]);

      try {
        const token = await getToken();

        const url = new URL(`${API_BASE_URL}/api/projects/${projectId}/correlate`);
        if (token) {
          url.searchParams.set('token', token);
        }
        if (customQuery) {
          url.searchParams.set('query', customQuery);
        }

        const es = new EventSource(url.toString());
        activeEventSourceRef.current = es;

        es.addEventListener('connection', () => {
          setStage('connected');
          setProgressMessage('Connection established. Initializing orchestrator...');
        });

        es.addEventListener('started', () => {
          setStage('started');
          setProgressMessage('Loading deterministic analyzer findings...');
        });

        es.addEventListener('tool_call', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            setStage('tool_call');
            const toolName = data.tool || 'analyzer';
            setProgressMessage(
              `Querying ${toolName.replace('get_', '').replace('_findings', '')} findings...`
            );
          } catch {
            setProgressMessage('Querying analyzer findings...');
          }
        });

        es.addEventListener('tool_result', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            setProgressMessage(
              `Retrieved ${data.findingCount || 0} findings from ${data.tool || 'analyzer'}.`
            );
          } catch {
            // Keep previous message
          }
        });

        es.addEventListener('reasoning', () => {
          setStage('reasoning');
          setProgressMessage('Claude reasoning across cross-layer evidence...');
        });

        es.addEventListener('correlation', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.correlation) {
              setDiscoveredCorrelations((prev) => [...prev, data.correlation]);
              setProgressMessage(
                `Discovered cross-layer correlation: ${data.correlation.relationship}`
              );
            }
          } catch {
            // Ignore parse errors
          }
        });

        es.addEventListener('completed', () => {
          setStage('completed');
          setProgressMessage('Correlation report complete!');
          stopStream();

          if (projectId) {
            queryClient.invalidateQueries({ queryKey: ['correlation-report', projectId] });
          }
        });

        es.addEventListener('error', (e: MessageEvent) => {
          let errorMsg = 'Correlation stream disconnected or encountered an error.';
          try {
            if (e.data) {
              const parsed = JSON.parse(e.data);
              if (parsed.message) errorMsg = parsed.message;
            }
          } catch {
            // Standard EventSource error
          }
          setStreamError(errorMsg);
          setStage('error');
          stopStream();
        });
      } catch (err: any) {
        setStreamError(err?.message || 'Failed to start correlation stream.');
        setStage('error');
        setIsStreaming(false);
      }
    },
    [projectId, getToken, queryClient, stopStream]
  );

  return {
    isStreaming,
    stage,
    progressMessage,
    streamError,
    discoveredCorrelations,
    startStream,
    stopStream,
  };
}
