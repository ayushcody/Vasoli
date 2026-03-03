import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

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
  contributions: GoalContribution[];
  createdAt: string;
  updatedAt: string;
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

export function useGoals(options: { status?: string } = {}) {
  const { status } = options;
  
  return useQuery({
    queryKey: [GOALS_KEY, { status }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      
      const queryString = params.toString();
      const url = `/goals${queryString ? `?${queryString}` : ''}`;
      
      return apiClient.get<Goal[]>(url);
    },
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: [GOALS_KEY, id],
    queryFn: async () => {
      return apiClient.get<Goal>(`/goals/${id}`);
    },
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateGoalInput) => {
      return apiClient.post<Goal>('/goals', data);
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
      return apiClient.patch<Goal>(`/goals/${id}`, data);
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
      return apiClient.delete<void>(`/goals/${id}`);
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
      return apiClient.post<GoalContribution>(`/goals/${data.goalId}/contributions`, data);
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
      return apiClient.get<{
        totalGoals: number;
        completedGoals: number;
        totalSaved: number;
        totalTarget: number;
        averageProgress: number;
        upcomingDeadlines: Goal[];
      }>('/goals/stats');
    },
    staleTime: 1000 * 60 * 2,
  });
}
