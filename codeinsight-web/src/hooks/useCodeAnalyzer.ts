import { useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  analyzeCode,
  getCodeFindings,
  type AnalyzeCodeParams,
  type CodeAnalyzerResult,
} from '../lib/api-client';

export function useCodeFindings(projectId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery<CodeAnalyzerResult, Error>({
    queryKey: ['code-findings', projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return getCodeFindings(projectId, getToken);
    },
    enabled: Boolean(isLoaded && isSignedIn && projectId),
    retry: (failureCount, error: any) => {
      // Don't retry if 404 (no completed code analysis session yet)
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useAnalyzeCode(projectId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  return useMutation<CodeAnalyzerResult, Error, AnalyzeCodeParams>({
    mutationFn: async (params: AnalyzeCodeParams) => {
      if (!projectId) {
        throw new Error('Project ID is required to execute code analysis');
      }
      if (inFlightRef.current) {
        throw new Error('Code analysis request already in flight');
      }
      inFlightRef.current = true;
      try {
        return await analyzeCode(projectId, params, getToken);
      } finally {
        inFlightRef.current = false;
      }
    },
    onSuccess: (newResult) => {
      if (projectId) {
        queryClient.setQueryData<CodeAnalyzerResult>(['code-findings', projectId], newResult);
        queryClient.invalidateQueries({ queryKey: ['code-findings', projectId] });
      }
    },
  });
}
