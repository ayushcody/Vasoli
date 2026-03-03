import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import type { Transaction, CreateTransactionInput, TransactionSummary } from '@/shared/types';

const QUERY_KEY = 'transactions';

export function useTransactions(filters?: {
  startDate?: string;
  endDate?: string;
  type?: string;
  categoryId?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.categoryId) params.append('categoryId', filters.categoryId);

  const queryString = params.toString();
  const url = `/transactions${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => api.get<Transaction[]>(url),
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => api.get<Transaction>(`/transactions/${id}`),
    enabled: !!id,
  });
}

export function useTransactionSummary() {
  return useQuery({
    queryKey: [QUERY_KEY, 'summary'],
    queryFn: () => api.get<TransactionSummary>('/transactions/summary'),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionInput) => api.post<Transaction>('/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Transaction created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionInput> }) =>
      api.patch<Transaction>(`/transactions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Transaction updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Transaction deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
