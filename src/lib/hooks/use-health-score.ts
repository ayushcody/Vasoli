import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export interface HealthScoreComponent {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface HealthScoreFactor {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  impact: number;
}

export interface HealthScoreInsight {
  category: string;
  tip: string;
  priority: 'high' | 'medium' | 'low';
}

export interface FinancialHealthScore {
  id: string;
  score: number;
  components: HealthScoreComponent[];
  factors: HealthScoreFactor[];
  insights: HealthScoreInsight[];
  date: string;
  userId: string;
}

export interface HealthScoreHistory {
  scores: Array<{
    date: string;
    score: number;
  }>;
  trend: 'improving' | 'declining' | 'stable';
  change: number;
}

const HEALTH_SCORE_KEY = 'health-score';

export function useHealthScore() {
  return useQuery({
    queryKey: [HEALTH_SCORE_KEY],
    queryFn: async () => {
      return apiClient.get<FinancialHealthScore>('/health-score');
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useHealthScoreHistory(options: { days?: number } = {}) {
  const { days = 30 } = options;
  
  return useQuery({
    queryKey: [HEALTH_SCORE_KEY, 'history', { days }],
    queryFn: async () => {
      return apiClient.get<HealthScoreHistory>(`/health-score/history?days=${days}`);
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCalculateHealthScore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return apiClient.post<FinancialHealthScore>('/health-score/calculate', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HEALTH_SCORE_KEY] });
      queryClient.invalidateQueries({ queryKey: [HEALTH_SCORE_KEY, 'history'] });
      toast.success('Health score recalculated');
    },
    onError: (error) => {
      toast.error('Failed to calculate health score', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useHealthScoreComparison() {
  return useQuery({
    queryKey: [HEALTH_SCORE_KEY, 'comparison'],
    queryFn: async () => {
      return apiClient.get<{
        yourScore: number;
        averageScore: number;
        percentile: number;
        comparisonGroup: string;
      }>('/health-score/comparison');
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
}
