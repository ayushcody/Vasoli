import { useQuery } from '@tanstack/react-query';
import { insightsClient } from '@/lib/rpc/clients';
import { format } from 'date-fns';

export function useSpendingAnalytics(monthYear?: string) {
  const targetMonth = monthYear || format(new Date(), 'yyyy-MM');
  return useQuery({
    queryKey: ['spending-analytics', targetMonth],
    queryFn: async () => {
      return insightsClient.getSpendingAnalytics({ monthYear: targetMonth });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMerchantInsights(monthYear?: string) {
  const targetMonth = monthYear || format(new Date(), 'yyyy-MM');
  return useQuery({
    queryKey: ['merchant-insights', targetMonth],
    queryFn: async () => {
      return insightsClient.getMerchantInsights({ monthYear: targetMonth });
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useEmergencyFundProgress() {
  return useQuery({
    queryKey: ['emergency-fund-progress'],
    queryFn: async () => {
      return insightsClient.getEmergencyFundProgress({});
    },
    staleTime: 1000 * 60 * 5,
  });
}
