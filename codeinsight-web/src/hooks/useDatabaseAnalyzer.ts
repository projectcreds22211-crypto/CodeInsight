import { useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  analyzeDatabase,
  getDatabaseFindings,
  type AnalyzeDatabaseParams,
  type DatabaseAnalyzerResult,
} from '../lib/api-client';

export function useDatabaseFindings(projectId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery<DatabaseAnalyzerResult, Error>({
    queryKey: ['database-findings', projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return getDatabaseFindings(projectId, getToken);
    },
    enabled: Boolean(isLoaded && isSignedIn && projectId),
    retry: (failureCount, error: any) => {
      // Don't retry if 404 (no completed session yet)
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useAnalyzeDatabase(projectId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  return useMutation<DatabaseAnalyzerResult, Error, AnalyzeDatabaseParams>({
    mutationFn: async (params: AnalyzeDatabaseParams) => {
      if (!projectId) {
        throw new Error('Project ID is required to execute database analysis');
      }
      if (inFlightRef.current) {
        throw new Error('Database analysis request already in flight');
      }
      inFlightRef.current = true;
      try {
        return await analyzeDatabase(projectId, params, getToken);
      } finally {
        inFlightRef.current = false;
      }
    },
    onSuccess: (newResult) => {
      if (projectId) {
        queryClient.setQueryData<DatabaseAnalyzerResult>(
          ['database-findings', projectId],
          newResult
        );
        queryClient.invalidateQueries({ queryKey: ['database-findings', projectId] });
      }
    },
  });
}
