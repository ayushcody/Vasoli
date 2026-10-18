import { useQuery } from "@tanstack/react-query";
import { achievementClient } from "@/lib/rpc/clients";

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await achievementClient.listAchievements({});
      return res.achievements;
    },
  });
}
