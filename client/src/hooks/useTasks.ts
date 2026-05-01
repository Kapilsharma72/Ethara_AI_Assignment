import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import type { Task } from '../types/api';

export interface CreateTaskData {
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  assigneeId?: number | null;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
  status?: 'To Do' | 'In Progress' | 'Done';
  assigneeId?: number | null;
}

interface UseTasksReturn {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: (projectId: number) => Promise<void>;
  createTask: (projectId: number, data: CreateTaskData) => Promise<Task>;
  updateTask: (projectId: number, taskId: number, data: UpdateTaskData) => Promise<Task>;
  deleteTask: (projectId: number, taskId: number) => Promise<void>;
}

export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (projectId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<Task[]>(`/api/projects/${projectId}/tasks`);
      setTasks(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr?.response
        ? (axiosErr.response.data?.message ?? 'Failed to load tasks.')
        : 'Network error. Please check your connection and try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTask = useCallback(
    async (projectId: number, data: CreateTaskData): Promise<Task> => {
      const response = await apiClient.post<Task>(`/api/projects/${projectId}/tasks`, data);
      const newTask = response.data;
      setTasks((prev) => [...prev, newTask]);
      return newTask;
    },
    []
  );

  const updateTask = useCallback(
    async (projectId: number, taskId: number, data: UpdateTaskData): Promise<Task> => {
      const response = await apiClient.patch<Task>(
        `/api/projects/${projectId}/tasks/${taskId}`,
        data
      );
      const updated = response.data;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    },
    []
  );

  const deleteTask = useCallback(async (projectId: number, taskId: number): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/tasks/${taskId}`);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  return { tasks, isLoading, error, fetchTasks, createTask, updateTask, deleteTask };
}
