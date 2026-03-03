import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export interface RecurringTransaction {
  id: string;
  amount: number;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
  occurrences?: number;
  lastRun?: string;
  nextRun?: string;
  isActive: boolean;
  userId: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringInput {
  amount: number;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
  occurrences?: number;
  categoryId?: string;
}

const RECURRING_KEY = 'recurring';

export function useRecurringTransactions(options: { isActive?: boolean } = {}) {
  const { isActive } = options;
  
  return useQuery({
    queryKey: [RECURRING_KEY, { isActive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isActive !== undefined) params.append('isActive', String(isActive));
      
      const queryString = params.toString();
      const url = `/recurring${queryString ? `?${queryString}` : ''}`;
      
      return apiClient.get<RecurringTransaction[]>(url);
    },
  });
}

export function useRecurringTransaction(id: string) {
  return useQuery({
    queryKey: [RECURRING_KEY, id],
    queryFn: async () => {
      return apiClient.get<RecurringTransaction>(`/recurring/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateRecurringInput) => {
      return apiClient.post<RecurringTransaction>('/recurring', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_KEY] });
      toast.success('Recurring transaction created');
    },
    onError: (error) => {
      toast.error('Failed to create recurring transaction', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateRecurringInput> }) => {
      return apiClient.patch<RecurringTransaction>(`/recurring/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_KEY] });
      queryClient.invalidateQueries({ queryKey: [RECURRING_KEY, variables.id] });
      toast.success('Recurring transaction updated');
    },
    onError: (error) => {
      toast.error('Failed to update recurring transaction', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useToggleRecurring() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClient.patch<RecurringTransaction>(`/recurring/${id}`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_KEY] });
      queryClient.invalidateQueries({ queryKey: [RECURRING_KEY, variables.id] });
      toast.success(variables.isActive ? 'Recurring transaction activated' : 'Recurring transaction paused');
    },
    onError: (error) => {
      toast.error('Failed to update recurring transaction', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete<void>(`/recurring/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_KEY] });
      toast.success('Recurring transaction deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete recurring transaction', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useUpcomingRecurring() {
  return useQuery({
    queryKey: [RECURRING_KEY, 'upcoming'],
    queryFn: async () => {
      return apiClient.get<Array<{
        recurring: RecurringTransaction;
        nextOccurrence: string;
        daysUntil: number;
      }>>('/recurring/upcoming');
    },
    staleTime: 1000 * 60 * 5,
  });
}
