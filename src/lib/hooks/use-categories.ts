import { useQuery } from "@tanstack/react-query";

import { categoryClient } from "@/lib/rpc/clients";

export interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  isDefault: boolean;
}

const CATEGORIES_KEY = "categories";

function mapCategory(category: any): Category {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
    isDefault: category.isDefault,
  };
}

export function useCategories() {
  return useQuery({
    queryKey: [CATEGORIES_KEY],
    queryFn: async () => {
      const response = await categoryClient.listCategories({});
      return response.categories.map(mapCategory);
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}
