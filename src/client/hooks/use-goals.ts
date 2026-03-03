import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import type { Goal, CreateGoalInput } from '@/shared/types';

const QUERY_KEY = 'goals';

export function useGoals(filters?: { status?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);

  const queryString = params.toString();
  const url = `/goals${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => api.get<Goal[]>(url),
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => api.get<Goal>(`/goals/${id}`),
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGoalInput) => api.post<Goal>('/goals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Goal created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGoalInput> }) =>
      api.patch<Goal>(`/goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Goal updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Goal deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAddGoalContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: { amount: number; note?: string } }) =>
      api.post(`/goals/${goalId}/contributions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Contribution added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
