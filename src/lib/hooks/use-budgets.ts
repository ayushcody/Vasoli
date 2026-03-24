import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetClient } from '@/lib/rpc/clients';
import { toast } from 'sonner';
import { Timestamp } from "@bufbuild/protobuf";

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

function mapBudget(b: any): Budget {
  const amount = Number(b.amountPaise) / 100;
  const spent = 0; // Need analytics for this
  return {
    id: b.id,
    name: b.name,
    amount: amount,
    period: b.period as any,
    startDate: b.startDate?.toDate().toISOString() || new Date().toISOString(),
    endDate: b.endDate?.toDate().toISOString() || new Date().toISOString(),
    categories: b.categories ? b.categories.split(",") : [],
    userId: b.userId,
    spent: spent,
    remaining: amount - spent,
    percentage: amount > 0 ? (spent / amount) * 100 : 0,
    isOverBudget: spent > amount,
    createdAt: b.createdAt?.toDate().toISOString() || new Date().toISOString(),
    updatedAt: b.updatedAt?.toDate().toISOString() || new Date().toISOString(),
  };
}

export function useBudgets() {
  return useQuery({
    queryKey: [BUDGETS_KEY],
    queryFn: async () => {
      const res = await budgetClient.listBudgets({});
      return res.budgets.map(mapBudget);
    },
  });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: [BUDGETS_KEY, id],
    queryFn: async () => {
      const res = await budgetClient.listBudgets({}); // No GetBudget RPC, filtering manually for now
      const b = res.budgets.find(b => b.id === id);
      if (!b) throw new Error("Budget not found");
      return mapBudget(b);
    },
    enabled: !!id,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBudgetInput) => {
      const res = await budgetClient.createBudget({
        name: data.name,
        amountPaise: BigInt(Math.round(data.amount * 100)),
        period: data.period,
        startDate: Timestamp.fromDate(new Date(data.startDate)),
        endDate: Timestamp.fromDate(new Date(data.endDate)),
        categories: data.categories.join(","),
      });
      return mapBudget(res.budget);
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
      const res = await budgetClient.updateBudget({
        id,
        name: data.name,
        amountPaise: data.amount !== undefined ? BigInt(Math.round(data.amount * 100)) : undefined,
        period: data.period,
        categories: data.categories?.join(","),
      });
      return mapBudget(res.budget);
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
      await budgetClient.deleteBudget({ id });
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
      // Stub for now
      return [];
    },
    staleTime: 1000 * 60 * 2,
  });
}
