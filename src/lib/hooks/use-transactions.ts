import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionClient, insightsClient } from '@/lib/rpc/clients';
import { toast } from 'sonner';
import { Timestamp } from "@bufbuild/protobuf";

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
  pageSize?: number;
}

const TRANSACTIONS_KEY = 'transactions';

function mapTransaction(t: any): Transaction {
  return {
    id: t.id,
    amount: Number(t.amountPaise) / 100,
    description: t.description,
    date: t.date?.toDate().toISOString() || new Date().toISOString(),
    type: t.type as any,
    receiptUrl: t.receiptUrl,
    isRecurring: t.isRecurring,
    recurringId: t.recurringId,
    userId: t.userId,
    categoryId: t.categoryId,
    category: t.categoryId ? { id: t.categoryId, name: "Category", icon: "📝" } : undefined,
    createdAt: t.createdAt?.toDate().toISOString() || new Date().toISOString(),
    updatedAt: t.updatedAt?.toDate().toISOString() || new Date().toISOString(),
  };
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { startDate, endDate, type, categoryId, pageSize } = options;
  const queryKey = [TRANSACTIONS_KEY, { startDate, endDate, type, categoryId, pageSize }];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await transactionClient.listTransactions({
        pageSize: pageSize || 50,
      });
      return res.transactions.map(mapTransaction);
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, id],
    queryFn: async () => {
      const res = await transactionClient.getTransaction({ id });
      if (!res.transaction) throw new Error("Transaction not found");
      return mapTransaction(res.transaction);
    },
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTransactionInput) => {
      const res = await transactionClient.createTransaction({
        amountPaise: BigInt(Math.round(data.amount * 100)),
        description: data.description,
        date: Timestamp.fromDate(new Date(data.date)),
        type: data.type,
        categoryId: data.categoryId,
        receiptUrl: data.receiptUrl,
      });
      return mapTransaction(res.transaction);
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
      const res = await transactionClient.updateTransaction({
        id,
        amountPaise: data.amount !== undefined ? BigInt(Math.round(data.amount * 100)) : undefined,
        description: data.description,
        date: data.date ? Timestamp.fromDate(new Date(data.date)) : undefined,
        type: data.type,
        categoryId: data.categoryId,
      });
      return mapTransaction(res.transaction);
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
      await transactionClient.deleteTransaction({ id });
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
      const currentMonth = new Date().toISOString().slice(0, 7);
      const res = await insightsClient.getSummary({ monthYear: currentMonth });
      return {
        totalIncome: Number(res.totalIncomePaise) / 100,
        totalExpenses: Number(res.totalExpensePaise) / 100,
        balance: Number(res.balancePaise) / 100,
        byCategory: {}, // Not supported in MVP summary yet
        byMonth: [],    // Not supported in MVP summary yet
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
