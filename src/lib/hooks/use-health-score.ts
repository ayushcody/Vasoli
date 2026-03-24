import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insightsClient } from '@/lib/rpc/clients';
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
      const res = await insightsClient.getHealthScore({});
      return {
        id: 'current',
        score: res.score,
        components: res.components.map(c => ({
          name: c.name,
          score: c.score,
          weight: c.weight,
          description: c.description,
        })),
        factors: res.factors.map(f => ({
          type: f.type as any,
          title: f.title,
          description: f.description,
          impact: f.impact,
        })),
        insights: res.insights.map(i => ({
          category: i.category,
          tip: i.tip,
          priority: i.priority as any,
        })),
        date: new Date().toISOString(),
        userId: 'current-user',
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useHealthScoreHistory(options: { days?: number } = {}) {
  const { days = 30 } = options;

  return useQuery({
    queryKey: [HEALTH_SCORE_KEY, 'history', { days }],
    queryFn: async () => {
      // Mock for now or add to proto
      return {
        scores: [],
        trend: 'stable',
        change: 0,
      } as HealthScoreHistory;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCalculateHealthScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await insightsClient.getHealthScore({}); // Recalculate is usually same as get if computed on fly
      return res;
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
      // Stub
      return {
        yourScore: 75,
        averageScore: 68,
        percentile: 82,
        comparisonGroup: 'Similar profiles',
      };
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
