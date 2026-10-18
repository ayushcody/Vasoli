import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Timestamp } from "@bufbuild/protobuf"
import { toast } from "sonner"

import { receiptClient } from "@/lib/rpc/clients"

export interface ReceiptItem {
  id: string
  userId: string
  merchant: string
  amountPaise: bigint
  purchaseDate?: Date
  returnBy?: Date
  warrantyUntil?: Date
  reimbursable: boolean
  ocrPayloadEncrypted: string
  createdAt?: Date
  snoozedUntil?: Date
}

export interface CreateReceiptInput {
  merchant: string
  amountPaise: bigint
  purchaseDate: Date
  returnBy?: Date
  warrantyUntil?: Date
  reimbursable: boolean
  ocrPayloadEncrypted: string
}

export interface UpdateReceiptInput {
  id: string
  reimbursable?: boolean
  returnBy?: Date
  warrantyUntil?: Date
  snoozedUntil?: Date
}

const RECEIPTS_KEY = "receipts"

function mapReceipt(receipt: any): ReceiptItem {
  return {
    id: receipt.id,
    userId: receipt.userId,
    merchant: receipt.merchant,
    amountPaise: BigInt(receipt.amountPaise.toString()),
    purchaseDate: receipt.purchaseDate?.toDate(),
    returnBy: receipt.returnBy?.toDate(),
    warrantyUntil: receipt.warrantyUntil?.toDate(),
    reimbursable: receipt.reimbursable,
    ocrPayloadEncrypted: receipt.ocrPayloadEncrypted,
    createdAt: receipt.createdAt?.toDate(),
    snoozedUntil: receipt.snoozedUntil?.toDate(),
  }
}

export function useReceipts() {
  return useQuery({
    queryKey: [RECEIPTS_KEY],
    queryFn: async () => {
      const response = await receiptClient.listReceipts({})
      return response.receipts.map(mapReceipt)
    },
  })
}

export function useExpiringReceipts(daysAhead = 30) {
  return useQuery({
    queryKey: [RECEIPTS_KEY, "expiring", daysAhead],
    queryFn: async () => {
      const response = await receiptClient.listExpiring({ daysAhead })
      return response.receipts.map(mapReceipt)
    },
  })
}

export function useCreateReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateReceiptInput) => {
      const response = await receiptClient.createReceipt({
        merchant: data.merchant,
        amountPaise: data.amountPaise,
        purchaseDate: Timestamp.fromDate(data.purchaseDate),
        returnBy: data.returnBy ? Timestamp.fromDate(data.returnBy) : undefined,
        warrantyUntil: data.warrantyUntil
          ? Timestamp.fromDate(data.warrantyUntil)
          : undefined,
        reimbursable: data.reimbursable,
        ocrPayloadEncrypted: data.ocrPayloadEncrypted,
      })

      return mapReceipt(response.receipt)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECEIPTS_KEY] })
      toast.success("Receipt stored in vault")
    },
    onError: (error) => {
      toast.error("Failed to save receipt", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })
}

export function useUpdateReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateReceiptInput) => {
      const response = await receiptClient.updateReceipt({
        id: data.id,
        reimbursable: data.reimbursable,
        returnBy: data.returnBy ? Timestamp.fromDate(data.returnBy) : undefined,
        warrantyUntil: data.warrantyUntil
          ? Timestamp.fromDate(data.warrantyUntil)
          : undefined,
        snoozedUntil: data.snoozedUntil
          ? Timestamp.fromDate(data.snoozedUntil)
          : undefined,
      })

      return mapReceipt(response.receipt)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECEIPTS_KEY] })
      toast.success("Receipt updated")
    },
    onError: (error) => {
      toast.error("Failed to update receipt", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })
}
