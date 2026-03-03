import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export interface Budget {
  id: string;
  name: string;
  amount: number;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  categories: string[];
  userId: string;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetInput {
  name: string;
  amount: number;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  categories: string[];
}

const BUDGETS_KEY = 'budgets';

export function useBudgets() {
  return useQuery({
    queryKey: [BUDGETS_KEY],
    queryFn: async () => {
      return apiClient.get<Budget[]>('/budgets');
    },
  });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: [BUDGETS_KEY, id],
    queryFn: async () => {
      return apiClient.get<Budget>(`/budgets/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateBudgetInput) => {
      return apiClient.post<Budget>('/budgets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
      toast.success('Budget created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create budget', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateBudgetInput> }) => {
      return apiClient.patch<Budget>(`/budgets/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY, variables.id] });
      toast.success('Budget updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update budget', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete<void>(`/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
      toast.success('Budget deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete budget', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useBudgetAlerts() {
  return useQuery({
    queryKey: [BUDGETS_KEY, 'alerts'],
    queryFn: async () => {
      return apiClient.get<Array<{
        budget: Budget;
        alertType: 'APPROACHING' | 'OVER' | 'CRITICAL';
        message: string;
      }>>('/budgets/alerts');
    },
    staleTime: 1000 * 60 * 2,
  });
}
