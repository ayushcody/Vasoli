import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Timestamp } from "@bufbuild/protobuf";
import { pilotClient, transactionClient } from "@/lib/rpc/clients";
import type { PaydayPlanConfig } from "@/gen/vasoli/v1/pilot_pb";

export const PAYDAY_PLAN_KEY = ["pilot", "payday-plan"] as const;

export function usePaydayPlan(scenarioExtraOutflowPaise = 0n) {
  return useQuery({
    queryKey: [...PAYDAY_PLAN_KEY, scenarioExtraOutflowPaise.toString()],
    queryFn: () => pilotClient.getPaydayPlan({ scenarioExtraOutflowPaise }),
  });
}

export function useUpdatePaydayPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: PaydayPlanConfig) => pilotClient.updatePaydayPlan({ config }),
    onSuccess: (response) => {
      queryClient.setQueryData(PAYDAY_PLAN_KEY, response.plan);
      queryClient.invalidateQueries({ queryKey: PAYDAY_PLAN_KEY });
    },
  });
}

export function useSetPaydayActionState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, state, snoozeUntil }: { actionId: string; state: "COMPLETED" | "DISMISSED" | "SNOOZED"; snoozeUntil?: Date }) =>
      pilotClient.setActionState({ actionId, state, snoozeUntil: snoozeUntil ? Timestamp.fromDate(snoozeUntil) : undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYDAY_PLAN_KEY }),
  });
}

export function useConfirmAccountBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, balancePaise }: { accountId: string; balancePaise: bigint }) =>
      pilotClient.confirmAccountBalance({ accountId, balancePaise, confirmedAt: Timestamp.fromDate(new Date()) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: PAYDAY_PLAN_KEY });
    },
  });
}

export function usePostedExpenseCandidates(input: { accountId?: string; search: string; pageToken: string; enabled: boolean }) {
  return useQuery({
    queryKey: ["transactions", "obligation-payment-candidates", input.accountId, input.search, input.pageToken],
    queryFn: async () => {
      const response = await transactionClient.listTransactions({
        pageSize: 50,
        pageToken: input.pageToken,
        accountId: input.accountId,
        type: "EXPENSE",
        search: input.search,
      });
      return {
        transactions: response.transactions
          .filter((transaction) => transaction.status === "POSTED" && transaction.type === "EXPENSE")
          .map((transaction) => ({
            id: transaction.id,
            description: transaction.description,
            amountPaise: transaction.amountPaise,
            date: transaction.date?.toDate().toISOString() || "",
          })),
        nextPageToken: response.nextPageToken,
      };
    },
    enabled: input.enabled,
  });
}

export function useRecordObligationPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recurringRuleId, occurrenceDate, transactionId }: { recurringRuleId: string; occurrenceDate: string; transactionId?: string }) =>
      pilotClient.recordObligationPayment({ recurringRuleId, occurrenceDate, transactionId, paidAt: Timestamp.fromDate(new Date()) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYDAY_PLAN_KEY });
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { fromAccountId: string; toAccountId: string; amountPaise: bigint; date: Date; description: string; idempotencyKey: string }) =>
      pilotClient.createTransfer({ ...input, date: Timestamp.fromDate(input.date) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: PAYDAY_PLAN_KEY });
    },
  });
}

export async function exportTransactionsCsv(filters: {
  accountId?: string;
  categoryId?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  const stream = pilotClient.exportTransactions({
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    type: filters.type && filters.type !== "ALL" ? filters.type : undefined,
    search: filters.search || "",
    startDate: filters.startDate ? Timestamp.fromDate(new Date(`${filters.startDate}T00:00:00+05:30`)) : undefined,
    endDate: filters.endDate ? Timestamp.fromDate(new Date(`${filters.endDate}T23:59:59.999+05:30`)) : undefined,
  });
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk.csvChunk);
  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "vasoli-activity.csv";
  anchor.click();
  URL.revokeObjectURL(url);
  return size;
}
