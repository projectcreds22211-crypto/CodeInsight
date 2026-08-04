import { useAuth } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, createDemoProject, type Project, type CreateProjectParams } from '../lib/api-client';

export function useProjects() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: async () => {
      return getProjects(getToken);
    },
    enabled: Boolean(isLoaded && isSignedIn),
  });
}

export function useCreateProject() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<Project, Error, CreateProjectParams>({
    mutationFn: async (params: CreateProjectParams) => {
      return createProject(params, getToken);
    },
    onSuccess: (newProject) => {
      // Optimistically update the cache with the newly created project
      queryClient.setQueryData<Project[]>(['projects'], (oldProjects) => {
        if (!oldProjects) return [newProject];
        return [newProject, ...oldProjects];
      });
      // Invalidate to trigger a fresh background sync
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useCreateDemoProject() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<Project, Error, void>({
    mutationFn: async () => {
      return createDemoProject(getToken);
    },
    onSuccess: (newProject) => {
      // Optimistically update the cache with the newly created demo project
      queryClient.setQueryData<Project[]>(['projects'], (oldProjects) => {
        if (!oldProjects) return [newProject];
        return [newProject, ...oldProjects];
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
