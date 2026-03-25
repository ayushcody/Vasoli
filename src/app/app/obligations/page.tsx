"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, MoreHorizontal, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  useCreateRecurring,
  useDeleteRecurring,
  useRecurringTransactions,
  useToggleRecurring,
  useUpcomingRecurring,
} from "@/lib/hooks/use-recurring";
import { track } from "@/lib/analytics";
import { formatCurrency, formatDate } from "@/lib/utils";

const recurringSchema = z.object({
  description: z.string().min(2, "Add a name for this obligation."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  startDate: z.string().min(1, "Pick a next due date."),
});

type RecurringValues = z.infer<typeof recurringSchema>;

const cadenceLabel: Record<RecurringValues["frequency"], string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export default function ObligationsPage() {
  const recurringQuery = useRecurringTransactions();
  const upcomingQuery = useUpcomingRecurring();
  const createRecurring = useCreateRecurring();
  const toggleRecurring = useToggleRecurring();
  const deleteRecurring = useDeleteRecurring();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PAUSED">("ALL");

  const form = useForm<RecurringValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      description: "",
      amount: 0,
      frequency: "MONTHLY",
      startDate: new Date().toISOString().slice(0, 10),
    },
  });

  const items = useMemo(() => recurringQuery.data || [], [recurringQuery.data]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "ACTIVE" && !item.isActive) {
        return false;
      }
      if (statusFilter === "PAUSED" && item.isActive) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [item.description, item.frequency].join(" ").toLowerCase().includes(query);
    });
  }, [items, search, statusFilter]);

  async function onSubmit(values: RecurringValues) {
    await createRecurring.mutateAsync({
      ...values,
      type: "EXPENSE",
    });
    track("recurring_created", { frequency: values.frequency });
    setDialogOpen(false);
    form.reset({
      description: "",
      amount: 0,
      frequency: "MONTHLY",
      startDate: new Date().toISOString().slice(0, 10),
    });
  }

  async function onToggle(id: string, isActive: boolean) {
    await toggleRecurring.mutateAsync({ id, isActive: !isActive });
    track("recurring_toggled", { active: !isActive });
  }

  async function onDelete(id: string) {
    await deleteRecurring.mutateAsync(id);
    track("recurring_deleted", {});
  }

  const estimatedMonthlyCommitment = filteredItems.reduce((sum, item) => sum + item.amount, 0);
  const upcomingCount = upcomingQuery.data?.length || 0;

  return (
    <div className="space-y-6">
      <section className="neo-surface-lg p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Obligations</p>
            <div>
              <h1 className="text-4xl font-black">Recurring spend deserves its own control panel.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-taupe">
                Track bills, subscriptions, and repeating obligations separately so the dashboard and forecast do not get surprised later.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Tracked rules</p>
              <p className="mt-2 text-2xl font-black">{items.length}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Upcoming</p>
              <p className="mt-2 text-2xl font-black">{upcomingCount}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Estimated commitment</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(estimatedMonthlyCommitment)}</p>
            </div>
          </div>
        </div>
      </section>

      <FirstRunHint
        title="Add the recurring stuff that makes the rest of your balance misleading."
        description="Rent, subscriptions, EMIs, and predictable transfers matter more to the forecast than another one-off coffee entry."
      />

      <section className="neo-surface p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-taupe" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search obligations"
                className="pl-9"
                aria-label="Search obligations"
              />
            </label>
            <Select value={statusFilter} onValueChange={(value: "ALL" | "ACTIVE" | "PAUSED") => setStatusFilter(value)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All rules</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Add obligation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Add recurring obligation</DialogTitle>
                <DialogDescription>Capture the bills and subscriptions the forecast should not miss.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Netflix, rent, gym, SIP..." />
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
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next due date</FormLabel>
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
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cadence</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose cadence" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(cadenceLabel).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    Create obligation
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {recurringQuery.error || upcomingQuery.error ? (
        <InlineErrorState
          title="Recurring obligations could not be loaded"
          description="The recurring rules or upcoming schedule request failed."
          onRetry={() => {
            recurringQuery.refetch();
            upcomingQuery.refetch();
          }}
        />
      ) : null}

      {recurringQuery.isLoading ? (
        <TableSkeleton rows={6} />
      ) : !items.length ? (
        <ScreenEmptyState
          icon={CalendarClock}
          title="No obligations yet"
          description="Add your repeating bills and subscriptions so the product can treat future commitments as real, not optional trivia."
          cta={{ label: "Add first obligation", onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <section className="neo-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.description}</TableCell>
                  <TableCell>{cadenceLabel[item.frequency as keyof typeof cadenceLabel] || item.frequency}</TableCell>
                  <TableCell>{item.nextRun ? formatDate(item.nextRun) : formatDate(item.startDate)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "neutral"}>{item.isActive ? "Active" : "Paused"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Open actions for ${item.description}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onToggle(item.id, item.isActive)}>
                          {item.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                          {item.isActive ? "Pause" : "Resume"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(item.id)}>
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
        </section>
      )}
    </div>
  );
}
