import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionClient, insightsClient } from '@/lib/rpc/clients';
import { toast } from 'sonner';
import { Timestamp } from "@bufbuild/protobuf";

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REFUND' | 'INVESTMENT';
  accountId?: string;
  transferGroupId?: string;
  transferDirection?: string;
  refundOfTransactionId?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  type: 'INCOME' | 'EXPENSE' | 'REFUND';
  categoryId?: string;
  receiptUrl?: string;
  splits?: Array<{
    amount: number;
    description?: string;
    categoryId: string;
  }>;
  accountId?: string;
  refundOfTransactionId?: string;
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
    date: t.date?.toDate().toISOString() || "",
    type: t.type as Transaction['type'],
    accountId: t.accountId || undefined,
    transferGroupId: t.transferGroupId || undefined,
    transferDirection: t.transferDirection || undefined,
    refundOfTransactionId: t.refundOfTransactionId || undefined,
    receiptUrl: t.receiptUrl,
    isRecurring: t.isRecurring,
    recurringId: t.recurringId,
    userId: t.userId,
    categoryId: t.categoryId,
    createdAt: t.createdAt?.toDate().toISOString(),
    updatedAt: t.updatedAt?.toDate().toISOString(),
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
        type,
        categoryId,
        startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : undefined,
        endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : undefined,
      });
      return res.transactions.map(mapTransaction);
    },
  });
}

export interface ActivityFilters {
  categoryId?: string;
  pageToken?: string;
  pageSize?: number;
  accountId?: string;
  search?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export function useActivityTransactions(filters: ActivityFilters) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, "activity", filters],
    queryFn: async () => {
      const response = await transactionClient.listTransactions({
        pageSize: filters.pageSize || 50,
        pageToken: filters.pageToken || "",
        accountId: filters.accountId || undefined,
        categoryId: filters.categoryId || undefined,
        search: filters.search || "",
        type: filters.type && filters.type !== "ALL" ? filters.type : undefined,
        startDate: filters.startDate ? Timestamp.fromDate(new Date(`${filters.startDate}T00:00:00+05:30`)) : undefined,
        endDate: filters.endDate ? Timestamp.fromDate(new Date(`${filters.endDate}T23:59:59.999+05:30`)) : undefined,
      });
      return {
        transactions: response.transactions.map(mapTransaction),
        nextPageToken: response.nextPageToken,
      };
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
        date: Timestamp.fromDate(new Date(/^\d{4}-\d{2}-\d{2}$/.test(data.date) ? `${data.date}T00:00:00+05:30` : data.date)),
        type: data.type,
        categoryId: data.categoryId,
        receiptUrl: data.receiptUrl,
        accountId: data.accountId,
        refundOfTransactionId: data.refundOfTransactionId,
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
        date: data.date ? Timestamp.fromDate(new Date(/^\d{4}-\d{2}-\d{2}$/.test(data.date) ? `${data.date}T00:00:00+05:30` : data.date)) : undefined,
        type: data.type,
        categoryId: data.categoryId,
        accountId: data.accountId,
        refundOfTransactionId: data.refundOfTransactionId,
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
