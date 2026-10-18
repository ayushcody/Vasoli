import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalClient } from '@/lib/rpc/clients';
import { toast } from 'sonner';
import { Timestamp } from "@bufbuild/protobuf";

export interface Goal {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';
  color?: string;
  icon?: string;
  userId: string;
  contributions?: GoalContribution[];
  createdAt?: string;
  updatedAt?: string;
  progress: number;
  daysRemaining?: number;
}

export interface GoalContribution {
  id: string;
  amount: number;
  note?: string;
  goalId: string;
  transactionId?: string;
  createdAt: string;
}

export interface CreateGoalInput {
  name: string;
  description?: string;
  targetAmount: number;
  deadline?: string;
  color?: string;
  icon?: string;
}

export interface CreateContributionInput {
  goalId: string;
  amount: number;
  note?: string;
  transactionId?: string;
}

const GOALS_KEY = 'goals';

function mapGoal(g: any): Goal {
  const target = Number(g.targetAmountPaise) / 100;
  const current = Number(g.currentAmountPaise) / 100;
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    targetAmount: target,
    currentAmount: current,
    deadline: g.dueDate?.toDate().toISOString(),
    status: g.status as Goal['status'],
    color: g.color,
    icon: g.icon,
    userId: g.userId,
    createdAt: g.createdAt?.toDate().toISOString(),
    updatedAt: g.updatedAt?.toDate().toISOString(),
    progress: Math.min(100, Math.round((current / target) * 100)) || 0,
    daysRemaining: g.dueDate ? Math.ceil((g.dueDate.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined,
  };
}

export function useGoals(options: { status?: string } = {}) {
  const { status } = options;

  return useQuery({
    queryKey: [GOALS_KEY, { status }],
    queryFn: async () => {
      const res = await goalClient.listGoals({});
      return res.goals.map(mapGoal);
    },
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: [GOALS_KEY, id],
    queryFn: async () => {
      const res = await goalClient.getGoal({ id });
      if (!res.goal) throw new Error("Goal not found");
      return mapGoal(res.goal);
    },
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGoalInput) => {
      const res = await goalClient.createGoal({
        name: data.name,
        description: data.description,
        targetAmountPaise: BigInt(Math.round(data.targetAmount * 100)),
        dueDate: data.deadline ? Timestamp.fromDate(new Date(data.deadline)) : undefined,
        color: data.color,
        icon: data.icon,
      });
      return mapGoal(res.goal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY] });
      toast.success('Goal created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create goal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateGoalInput> }) => {
      const res = await goalClient.updateGoal({
        id,
        name: data.name,
        targetAmountPaise: data.targetAmount !== undefined ? BigInt(Math.round(data.targetAmount * 100)) : undefined,
      });
      return mapGoal(res.goal);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY] });
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY, variables.id] });
      toast.success('Goal updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update goal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await goalClient.deleteGoal({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY] });
      toast.success('Goal deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete goal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useCreateContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContributionInput) => {
      const res = await goalClient.addContribution({
        goalId: data.goalId,
        amountPaise: BigInt(Math.round(data.amount * 100)),
        note: data.note,
      });
      return mapGoal(res.goal);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY] });
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY, variables.goalId] });
      toast.success('Contribution added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add contribution', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useGoalStats() {
  return useQuery({
    queryKey: [GOALS_KEY, 'stats'],
    queryFn: async () => {
      // Use summary or goals list to compute
      const res = await goalClient.listGoals({});
      const goals = res.goals;
      const totalSaved = goals.reduce((acc, g) => acc + Number(g.currentAmountPaise), 0) / 100;
      const totalTarget = goals.reduce((acc, g) => acc + Number(g.targetAmountPaise), 0) / 100;
      return {
        totalGoals: goals.length,
        completedGoals: goals.filter(g => Number(g.currentAmountPaise) >= Number(g.targetAmountPaise)).length,
        totalSaved,
        totalTarget,
        averageProgress: goals.length > 0 ? (totalSaved / totalTarget) * 100 : 0,
        upcomingDeadlines: goals.map(mapGoal),
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}
