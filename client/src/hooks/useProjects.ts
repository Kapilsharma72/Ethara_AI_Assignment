import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import type { Project, ProjectDetail } from '../types/api';

interface CreateProjectData {
  name: string;
  description?: string;
}

interface UseProjectsReturn {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<Project>;
  fetchProjectDetail: (projectId: number) => Promise<ProjectDetail>;
  addMember: (projectId: number, userId: number) => Promise<void>;
  removeMember: (projectId: number, userId: number) => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<Project[]>('/api/projects');
      setProjects(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr?.response
        ? (axiosErr.response.data?.message ?? 'Failed to load projects.')
        : 'Network error. Please check your connection and try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = useCallback(async (data: CreateProjectData): Promise<Project> => {
    const response = await apiClient.post<Project>('/api/projects', data);
    return response.data;
  }, []);

  const fetchProjectDetail = useCallback(async (projectId: number): Promise<ProjectDetail> => {
    const response = await apiClient.get<ProjectDetail>(`/api/projects/${projectId}`);
    return response.data;
  }, []);

  const addMember = useCallback(async (projectId: number, userId: number): Promise<void> => {
    await apiClient.post(`/api/projects/${projectId}/members`, { userId });
  }, []);

  const removeMember = useCallback(async (projectId: number, userId: number): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/members/${userId}`);
  }, []);

  return {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    fetchProjectDetail,
    addMember,
    removeMember,
  };
}
