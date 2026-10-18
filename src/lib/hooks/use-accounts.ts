import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountClient } from "../rpc/clients";
import { FinancialAccount, Liability } from "@/gen/vasoli/v1/account_pb";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const resp = await accountClient.listAccounts({});
      return resp.accounts;
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: {
      accountType: string;
      institutionName: string;
      accountName: string;
      maskedAccountNumber?: string;
      balancePaise: bigint;
      currency: string;
    }) => {
      const resp = await accountClient.createAccount(req);
      return resp.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: {
      id: string;
      accountType?: string;
      institutionName?: string;
      accountName?: string;
      maskedAccountNumber?: string;
      balancePaise?: bigint;
      currency?: string;
    }) => {
      const resp = await accountClient.updateAccount(req);
      return resp.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await accountClient.deleteAccount({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useLiabilities() {
  return useQuery({
    queryKey: ["liabilities"],
    queryFn: async () => {
      const resp = await accountClient.listLiabilities({});
      return resp.liabilities;
    },
  });
}

export function useCreateLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: {
      accountId?: string;
      liabilityType: string;
      principalPaise: bigint;
      outstandingPaise: bigint;
      interestRateBps?: number;
      emiPaise?: bigint;
      dueDay?: number;
      startDate?: Date;
      endDate?: Date;
    }) => {
      const payload: any = { ...req };
      if (req.startDate) {
        payload.startDate = { seconds: BigInt(Math.floor(req.startDate.getTime() / 1000)), nanos: (req.startDate.getTime() % 1000) * 1000000 };
      }
      if (req.endDate) {
        payload.endDate = { seconds: BigInt(Math.floor(req.endDate.getTime() / 1000)), nanos: (req.endDate.getTime() % 1000) * 1000000 };
      }
      const resp = await accountClient.createLiability(payload);
      return resp.liability;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useUpdateLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: {
      id: string;
      accountId?: string;
      liabilityType?: string;
      principalPaise?: bigint;
      outstandingPaise?: bigint;
      interestRateBps?: number;
      emiPaise?: bigint;
      dueDay?: number;
      startDate?: Date;
      endDate?: Date;
    }) => {
      const payload: any = { ...req };
      if (req.startDate) {
        payload.startDate = { seconds: BigInt(Math.floor(req.startDate.getTime() / 1000)), nanos: (req.startDate.getTime() % 1000) * 1000000 };
      }
      if (req.endDate) {
        payload.endDate = { seconds: BigInt(Math.floor(req.endDate.getTime() / 1000)), nanos: (req.endDate.getTime() % 1000) * 1000000 };
      }
      const resp = await accountClient.updateLiability(payload);
      return resp.liability;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useDeleteLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await accountClient.deleteLiability({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useNetWorthSummary() {
  return useQuery({
    queryKey: ["netWorth"],
    queryFn: async () => {
      const resp = await accountClient.getNetWorthSummary({});
      return resp;
    },
  });
}
