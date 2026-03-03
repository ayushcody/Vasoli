import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  receiptUrl?: string;
  isRecurring: boolean;
  recurringId?: string;
  userId: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
  };
  splits?: TransactionSplit[];
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSplit {
  id: string;
  amount: number;
  description?: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
  };
}

export interface CreateTransactionInput {
  amount: number;
  description: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  receiptUrl?: string;
  splits?: Array<{
    amount: number;
    description?: string;
    categoryId: string;
  }>;
}

interface UseTransactionsOptions {
  startDate?: string;
  endDate?: string;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
}

const TRANSACTIONS_KEY = 'transactions';

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { startDate, endDate, type, categoryId } = options;
  
  const queryKey = [TRANSACTIONS_KEY, { startDate, endDate, type, categoryId }];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (type) params.append('type', type);
      if (categoryId) params.append('categoryId', categoryId);
      
      const queryString = params.toString();
      const url = `/transactions${queryString ? `?${queryString}` : ''}`;
      
      return apiClient.get<Transaction[]>(url);
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, id],
    queryFn: async () => {
      return apiClient.get<Transaction>(`/transactions/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateTransactionInput) => {
      return apiClient.post<Transaction>('/transactions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] });
      toast.success('Transaction created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create transaction', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTransactionInput> }) => {
      return apiClient.patch<Transaction>(`/transactions/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY, variables.id] });
      toast.success('Transaction updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update transaction', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete<void>(`/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] });
      toast.success('Transaction deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete transaction', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useTransactionSummary() {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, 'summary'],
    queryFn: async () => {
      return apiClient.get<{
        totalIncome: number;
        totalExpenses: number;
        balance: number;
        byCategory: Record<string, number>;
        byMonth: Array<{ month: string; income: number; expenses: number }>;
      }>('/transactions/summary');
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
