import { useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  analyzeLogs,
  getLogFindings,
  type AnalyzeLogsParams,
  type LogAnalyzerResult,
} from '../lib/api-client';

export function useLogFindings(projectId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery<LogAnalyzerResult, Error>({
    queryKey: ['log-findings', projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return getLogFindings(projectId, getToken);
    },
    enabled: Boolean(isLoaded && isSignedIn && projectId),
    retry: (failureCount, error: any) => {
      // Don't retry if 404 (no completed analysis session yet)
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useAnalyzeLogs(projectId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  return useMutation<LogAnalyzerResult, Error, AnalyzeLogsParams>({
    mutationFn: async (params: AnalyzeLogsParams) => {
      if (!projectId) {
        throw new Error('Project ID is required to execute log analysis');
      }
      if (inFlightRef.current) {
        throw new Error('Log analysis request already in flight');
      }
      inFlightRef.current = true;
      try {
        return await analyzeLogs(projectId, params, getToken);
      } finally {
        inFlightRef.current = false;
      }
    },
    onSuccess: (newResult) => {
      if (projectId) {
        queryClient.setQueryData<LogAnalyzerResult>(['log-findings', projectId], newResult);
        queryClient.invalidateQueries({ queryKey: ['log-findings', projectId] });
      }
    },
  });
}
