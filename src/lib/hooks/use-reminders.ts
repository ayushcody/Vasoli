import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  type: 'BILL_DUE' | 'GOAL_MILESTONE' | 'BUDGET_ALERT' | 'RECURRING_REVIEW' | 'CUSTOM';
  dueDate: string;
  status: 'PENDING' | 'SNOOZED' | 'COMPLETED' | 'DISMISSED';
  snoozeUntil?: string;
  metadata?: Record<string, unknown>;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  title: string;
  description?: string;
  type: 'BILL_DUE' | 'GOAL_MILESTONE' | 'BUDGET_ALERT' | 'RECURRING_REVIEW' | 'CUSTOM';
  dueDate: string;
  metadata?: Record<string, unknown>;
}

const REMINDERS_KEY = 'reminders';

export function useReminders(options: { status?: string; upcoming?: boolean } = {}) {
  const { status, upcoming } = options;
  
  return useQuery({
    queryKey: [REMINDERS_KEY, { status, upcoming }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (upcoming) params.append('upcoming', 'true');
      
      const queryString = params.toString();
      const url = `/reminders${queryString ? `?${queryString}` : ''}`;
      
      return apiClient.get<Reminder[]>(url);
    },
  });
}

export function useReminder(id: string) {
  return useQuery({
    queryKey: [REMINDERS_KEY, id],
    queryFn: async () => {
      return apiClient.get<Reminder>(`/reminders/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateReminderInput) => {
      return apiClient.post<Reminder>('/reminders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      toast.success('Reminder created');
    },
    onError: (error) => {
      toast.error('Failed to create reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateReminderInput> }) => {
      return apiClient.patch<Reminder>(`/reminders/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, variables.id] });
      toast.success('Reminder updated');
    },
    onError: (error) => {
      toast.error('Failed to update reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.patch<Reminder>(`/reminders/${id}/complete`, {});
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, id] });
      toast.success('Reminder completed');
    },
    onError: (error) => {
      toast.error('Failed to complete reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useSnoozeReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, until }: { id: string; until: string }) => {
      return apiClient.patch<Reminder>(`/reminders/${id}/snooze`, { until });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, variables.id] });
      toast.success('Reminder snoozed');
    },
    onError: (error) => {
      toast.error('Failed to snooze reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDismissReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.patch<Reminder>(`/reminders/${id}/dismiss`, {});
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, id] });
      toast.success('Reminder dismissed');
    },
    onError: (error) => {
      toast.error('Failed to dismiss reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete<void>(`/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      toast.success('Reminder deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useReminderStats() {
  return useQuery({
    queryKey: [REMINDERS_KEY, 'stats'],
    queryFn: async () => {
      return apiClient.get<{
        total: number;
        pending: number;
        snoozed: number;
        completed: number;
        overdue: number;
      }>('/reminders/stats');
    },
    staleTime: 1000 * 60 * 2,
  });
}
