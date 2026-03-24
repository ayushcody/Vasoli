import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringClient } from '@/lib/rpc/clients';
import { toast } from 'sonner';
import { Timestamp } from "@bufbuild/protobuf";

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

function mapRecurring(r: any): RecurringTransaction {
  return {
    id: r.id,
    amount: Number(r.amountPaise) / 100,
    description: r.merchantNorm || "Recurring",
    type: 'EXPENSE', // Defaulting to EXPENSE for now
    frequency: r.cadence as any,
    startDate: r.nextDueDate?.toDate().toISOString() || new Date().toISOString(),
    isActive: r.active,
    userId: r.userId,
    createdAt: new Date().toISOString(), // Mock
    updatedAt: new Date().toISOString(), // Mock
  };
}

export function useRecurringTransactions(options: { isActive?: boolean } = {}) {
  const { isActive } = options;

  return useQuery({
    queryKey: [RECURRING_KEY, { isActive }],
    queryFn: async () => {
      const res = await recurringClient.listRules({});
      return res.rules.map(mapRecurring).filter(r => isActive === undefined || r.isActive === isActive);
    },
  });
}

export function useRecurringTransaction(id: string) {
  return useQuery({
    queryKey: [RECURRING_KEY, id],
    queryFn: async () => {
      const res = await recurringClient.getRule({ id });
      if (!res.rule) throw new Error("Recurring rule not found");
      return mapRecurring(res.rule);
    },
    enabled: !!id,
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRecurringInput) => {
      const res = await recurringClient.createRuleFromCandidate({
        merchantNorm: data.description,
        amountPaise: BigInt(Math.round(data.amount * 100)),
        cadence: data.frequency,
        nextDueDate: Timestamp.fromDate(new Date(data.startDate)),
      });
      return mapRecurring(res.rule);
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
      const res = await recurringClient.updateRule({
        id,
        amountPaise: data.amount !== undefined ? BigInt(Math.round(data.amount * 100)) : undefined,
        cadence: data.frequency,
      });
      return mapRecurring(res.rule);
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
      const res = await recurringClient.updateRule({
        id,
        active: isActive,
      });
      return mapRecurring(res.rule);
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
      await recurringClient.deleteRule({ id });
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
      const res = await recurringClient.listUpcoming({ daysAhead: 30 });
      return res.rules.map(r => ({
        recurring: mapRecurring(r),
        nextOccurrence: r.nextDueDate?.toDate().toISOString() || new Date().toISOString(),
        daysUntil: 7, // Placeholder
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
