"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDownUp,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { StatementImporter } from "@/components/import/statement-importer";
import { FirstRunHint, InlineErrorState, ScreenEmptyState, TableSkeleton } from "@/components/app/screen-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactionSummary,
  useTransactions,
  useUpdateTransaction,
  type Transaction,
} from "@/lib/hooks";
import { track } from "@/lib/analytics";
import { formatCurrency, formatDate } from "@/lib/utils";

const transactionSchema = z.object({
  description: z.string().min(2, "Add a short description."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  date: z.string().min(1, "Pick a transaction date."),
  type: z.enum(["INCOME", "EXPENSE"]),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

type SortKey = "date" | "amount" | "description";
type TypeFilter = "ALL" | "INCOME" | "EXPENSE";

function exportTransactionsCsv(rows: Transaction[]) {
  const header = ["Date", "Description", "Type", "Amount"];
  const body = rows.map((row) =>
    [formatDate(row.date), row.description, row.type, row.amount.toString()]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "vasoli-transactions.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [page, setPage] = useState(1);
  const [isImporterOpen, setImporterOpen] = useState(false);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const transactionsQuery = useTransactions({
    pageSize: 200,
    type: typeFilter === "ALL" ? undefined : typeFilter,
  });
  const summaryQuery = useTransactionSummary();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      type: "EXPENSE",
    },
  });

  const transactions = useMemo(() => transactionsQuery.data || [], [transactionsQuery.data]);
  const pageSize = 8;

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = transactions.filter((transaction) => {
      if (!query) {
        return true;
      }

      return [transaction.description, transaction.category?.name || "Uncategorised", transaction.type]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    next.sort((left, right) => {
      if (sortKey === "amount") {
        return right.amount - left.amount;
      }
      if (sortKey === "description") {
        return left.description.localeCompare(right.description);
      }
      return new Date(right.date).getTime() - new Date(left.date).getTime();
    });

    return next;
  }, [search, sortKey, transactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const pagedTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  function openCreateDialog() {
    setEditingTransaction(null);
    form.reset({
      description: "",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      type: "EXPENSE",
    });
    setEditorOpen(true);
  }

  function openEditDialog(transaction: Transaction) {
    setEditingTransaction(transaction);
    form.reset({
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date.slice(0, 10),
      type: transaction.type,
    });
    setEditorOpen(true);
  }

  async function handleSubmit(values: TransactionFormValues) {
    if (editingTransaction) {
      await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        data: values,
      });
      track("transaction_updated", { type: values.type });
    } else {
      await createTransaction.mutateAsync(values);
      track("transaction_created", { type: values.type });
    }

    setEditorOpen(false);
    form.reset();
  }

  async function handleDelete(transaction: Transaction) {
    await deleteTransaction.mutateAsync(transaction.id);
    track("transaction_deleted", { type: transaction.type });
  }

  function handleExport() {
    exportTransactionsCsv(filteredTransactions);
    toast.success("CSV export ready");
    track("transactions_exported", { rows: filteredTransactions.length });
  }

  const hasNoTransactions = !transactionsQuery.isLoading && !transactions.length;
  const hasError = Boolean(transactionsQuery.error || summaryQuery.error);

  return (
    <div className="space-y-6">
      <section className="neo-surface-lg p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Transactions</p>
            <div>
              <h1 className="text-4xl font-black">Clean ledger review, not a raw dump.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-taupe">
                Search, filter, import statements, add manual corrections, and export the current table without leaving the screen.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Balance</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(summaryQuery.data?.balance || 0)}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Income</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(summaryQuery.data?.totalIncome || 0)}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Expenses</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(summaryQuery.data?.totalExpenses || 0)}</p>
            </div>
          </div>
        </div>
      </section>

      <FirstRunHint
        title="Import one statement first, then use manual entries only for cleanup."
        description="That keeps your ledger trustworthy and avoids turning the app into another spreadsheet you have to babysit."
      />

      <section className="neo-surface p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-taupe" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search description, type, or category"
                className="pl-9"
                aria-label="Search transactions"
              />
            </label>
            <Select value={typeFilter} onValueChange={(value: TypeFilter) => setTypeFilter(value)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(value: SortKey) => setSortKey(value)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest first</SelectItem>
                <SelectItem value="amount">Largest amount</SelectItem>
                <SelectItem value="description">Description A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={isImporterOpen} onOpenChange={setImporterOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileSpreadsheet className="size-4" />
                  Import statement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import a statement</DialogTitle>
                  <DialogDescription>Bring in a bank file, then refine the ledger from the table.</DialogDescription>
                </DialogHeader>
                <StatementImporter />
              </DialogContent>
            </Dialog>
            <Dialog open={isEditorOpen} onOpenChange={setEditorOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="size-4" />
                  Add transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingTransaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
                  <DialogDescription>
                    Use manual entries for corrections, one-off expenses, or missing income.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Swiggy, salary, rent, refund..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-5 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (INR)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="0" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="EXPENSE">Expense</SelectItem>
                              <SelectItem value="INCOME">Income</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                      {editingTransaction ? "Save changes" : "Create transaction"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleExport} disabled={!filteredTransactions.length}>
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </section>

      {hasError ? (
        <InlineErrorState
          title="Transactions could not be loaded"
          description="The ledger or summary query failed. Retry both requests from here."
          onRetry={() => {
            transactionsQuery.refetch();
            summaryQuery.refetch();
          }}
        />
      ) : null}

      {transactionsQuery.isLoading ? (
        <TableSkeleton rows={8} />
      ) : hasNoTransactions ? (
        <ScreenEmptyState
          icon={ReceiptText}
          title="No transactions yet"
          description="Import a bank file or add your first transaction manually. The dashboard and zine become useful once the ledger has at least a little history."
          cta={{ label: "Import statement", onClick: () => setImporterOpen(true) }}
        />
      ) : (
        <section className="neo-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-semibold">{transaction.description}</p>
                      <p className="text-xs text-main-foreground/70">{transaction.category?.name || "Uncategorised"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={transaction.type === "INCOME" ? "default" : "neutral"}>{transaction.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={transaction.type === "INCOME" ? "text-teal" : ""}>
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Open actions for ${transaction.description}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(transaction)}>
                          <ArrowDownUp className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(transaction)}>
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t-brutal bg-paper-1 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-taupe">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredTransactions.length)} of{" "}
              {filteredTransactions.length}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
