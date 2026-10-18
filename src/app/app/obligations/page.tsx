"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, MoreHorizontal, Pause, Play, Plus, Search, Trash2, Check, Bell, Clock, CalendarDays } from "lucide-react";
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
  useRecurringCandidates,
  useUpdateRecurring,
} from "@/lib/hooks/use-recurring";
import {
  useCreateReminder,
  useUpcomingReminders,
  useCompleteReminder,
  useDismissReminder,
  useSnoozeReminder
} from "@/lib/hooks/use-reminders";
import { track } from "@/lib/analytics";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { BillPaymentDialog } from "@/components/app/bill-payment-dialog";
import type { RecurringTransaction } from "@/lib/hooks/use-recurring";

const recurringSchema = z.object({
  description: z.string().min(2, "Add a name for this obligation."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  startDate: z.string().min(1, "Pick a next due date."),
  accountId: z.string().min(1, "Choose the account used to pay this obligation."),
});

type RecurringValues = z.infer<typeof recurringSchema>;

const cadenceLabel: Record<RecurringValues["frequency"], string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const reminderSchema = z.object({
  title: z.string().min(2, "Add a title for this reminder."),
  description: z.string().optional(),
  type: z.enum(["BILL_DUE", "GOAL_MILESTONE", "BUDGET_ALERT", "RECURRING_REVIEW", "CUSTOM"]),
  dueDate: z.string().min(1, "Pick a due date."),
});

type ReminderValues = z.infer<typeof reminderSchema>;

const reminderTypeLabel: Record<ReminderValues["type"], string> = {
  BILL_DUE: "Bill Due",
  GOAL_MILESTONE: "Goal Milestone",
  BUDGET_ALERT: "Budget Alert",
  RECURRING_REVIEW: "Review Rule",
  CUSTOM: "Custom",
};

export default function ObligationsPage() {
  const accounts = useAccounts();
  const recurringQuery = useRecurringTransactions();
  const upcomingQuery = useUpcomingRecurring();
  const candidatesQuery = useRecurringCandidates();
  const createRecurring = useCreateRecurring();
  const toggleRecurring = useToggleRecurring();
  const deleteRecurring = useDeleteRecurring();
  const updateRecurring = useUpdateRecurring();
  const remindersQuery = useUpcomingReminders();
  const createReminder = useCreateReminder();
  const completeReminder = useCompleteReminder();
  const dismissReminder = useDismissReminder();
  const snoozeReminder = useSnoozeReminder();

  const [isRecurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [isReminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PAUSED">("ALL");
  const [paymentRule, setPaymentRule] = useState<RecurringTransaction | null>(null);

  const form = useForm<RecurringValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      description: "",
      amount: 0,
      frequency: "MONTHLY",
      startDate: new Date().toISOString().slice(0, 10),
      accountId: "",
    },
  });

  const reminderForm = useForm<ReminderValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "BILL_DUE",
      dueDate: new Date().toISOString().slice(0, 10),
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
      accountId: values.accountId || undefined,
    });
    track("recurring_created", { frequency: values.frequency });
    setRecurringDialogOpen(false);
    form.reset();
  }

  async function onReminderSubmit(values: ReminderValues) {
    await createReminder.mutateAsync(values);
    track("reminder_created", { type: values.type });
    setReminderDialogOpen(false);
    reminderForm.reset();
  }

  async function onToggle(id: string, isActive: boolean) {
    await toggleRecurring.mutateAsync({ id, isActive: !isActive });
    track("recurring_toggled", { active: !isActive });
  }

  async function onDelete(id: string) {
    await deleteRecurring.mutateAsync(id);
    track("recurring_deleted", {});
  }

  function onMarkPaid(item: RecurringTransaction) {
    setPaymentRule(item);
  }

  function downloadCalendar(selectedId?: string) {
    const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const ymd = (value: string) => value.replaceAll("-", "");
    const activeRules = items.filter((item) => item.isActive && item.nextRun && (!selectedId || item.id === selectedId));
    const calendarEvents = activeRules.map((item) => {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(item.nextRun!));
      const [frequency, interval] = item.frequency === "BIWEEKLY" ? ["WEEKLY", "2"] : item.frequency === "QUARTERLY" ? ["MONTHLY", "3"] : [item.frequency, "1"];
      return ["BEGIN:VEVENT", `UID:${item.id}@vasoli.app`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, `DTSTART;VALUE=DATE:${ymd(day)}`, `RRULE:FREQ=${frequency};INTERVAL=${interval}`, `SUMMARY:${escapeIcs(item.description)}`, `DESCRIPTION:${escapeIcs(`${item.type} · ${formatCurrency(item.amount)} · Vasoli reminder`)}`, "END:VEVENT"].join("\r\n");
    });
    const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vasoli//Obligations//EN", "CALSCALE:GREGORIAN", ...calendarEvents, "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "vasoli-obligations.ics"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const estimatedMonthlyCommitment = filteredItems.reduce((sum, item) => sum + item.amount, 0);
  const upcomingCount = upcomingQuery.data?.length || 0;

  // Group reminders
  const remindersByTime = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const groups = {
      today: [] as any[],
      thisWeek: [] as any[],
      later: [] as any[]
    };

    (remindersQuery.data || []).forEach(reminder => {
      const dueDate = new Date(reminder.dueDate);
      if (dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
        groups.today.push(reminder);
      } else if (dueDate < nextWeek) {
        groups.thisWeek.push(reminder);
      } else {
        groups.later.push(reminder);
      }
    });

    return groups;
  }, [remindersQuery.data]);

  return (
    <div className="space-y-6">
      <section className="neo-surface-lg p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Obligations & Reminders</p>
            <div>
              <h1 className="text-4xl font-black">Your financial commitments.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-taupe">
                Track repeating bills and one-off actionable reminders here so you don&apos;t miss payments or goal deadlines.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Rules</p>
              <p className="mt-2 text-2xl font-black">{items.length}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Reminders</p>
              <p className="mt-2 text-2xl font-black">{remindersQuery.data?.length || 0}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Est. commitment</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(estimatedMonthlyCommitment)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* REMINDERS SECTION */}
      <section className="neo-surface p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold">Upcoming Reminders</h2>
          <Dialog open={isReminderDialogOpen} onOpenChange={setReminderDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Add reminder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add a new reminder</DialogTitle>
                <DialogDescription>Create a manual reminder for a bill or goal.</DialogDescription>
              </DialogHeader>
              <Form {...reminderForm}>
                <form className="space-y-5" onSubmit={reminderForm.handleSubmit(onReminderSubmit)}>
                  <FormField
                    control={reminderForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Pay electricity bill..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={reminderForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Amount around 1200 INR..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField
                      control={reminderForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={reminderForm.control}
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
                              {Object.entries(reminderTypeLabel).map(([value, label]) => (
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
                  </div>
                  <Button type="submit" className="w-full" disabled={reminderForm.formState.isSubmitting}>
                    Create Reminder
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {remindersQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : !remindersQuery.data?.length ? (
          <div className="rounded-neo border-brutal bg-paper-1 p-6 text-center">
            <Bell className="mx-auto mb-3 size-8 text-taupe" />
            <p className="font-serif text-xl font-bold text-ink">No reminders yet</p>
            <p className="mt-2 text-sm text-taupe">
              Keep track of actionable due dates by creating your first bill reminder.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {remindersByTime.today.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-red-600 mb-3 flex items-center gap-2"><Clock size={16}/> Today & Overdue</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {remindersByTime.today.map((r) => <ReminderCard key={r.id} reminder={r} onComplete={completeReminder.mutate} onSnooze={snoozeReminder.mutate} onDismiss={dismissReminder.mutate} />)}
                </div>
              </div>
            )}
            {remindersByTime.thisWeek.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-ink mb-3">This Week</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {remindersByTime.thisWeek.map((r) => <ReminderCard key={r.id} reminder={r} onComplete={completeReminder.mutate} onSnooze={snoozeReminder.mutate} onDismiss={dismissReminder.mutate} />)}
                </div>
              </div>
            )}
            {remindersByTime.later.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-taupe mb-3">Later</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {remindersByTime.later.map((r) => <ReminderCard key={r.id} reminder={r} onComplete={completeReminder.mutate} onSnooze={snoozeReminder.mutate} onDismiss={dismissReminder.mutate} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>


      {/* SUGGESTED OBLIGATIONS SECTION */}
      {candidatesQuery.data && candidatesQuery.data.length > 0 && (
        <section className="neo-surface p-5 bg-primary/5 border-primary/20">
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-bold text-primary">Suggested Obligations</h2>
            <p className="text-sm text-taupe mt-1">We noticed these recurring transactions. Add them to track your commitments.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {candidatesQuery.data.map((candidate, idx) => (
              <div key={idx} className="rounded-neo border-brutal bg-paper-1 p-4 flex flex-col justify-between">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink truncate">{candidate.merchantNorm}</p>
                    <span className="shrink-0 rounded-full border-brutal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                      {Math.round(candidate.confidenceScore)}% Match
                    </span>
                  </div>
                  <p className="text-sm text-taupe mb-3">
                    Looks like a <strong className="text-ink">{candidate.inferredCadence}</strong> expense of <strong className="text-ink">{formatCurrency(candidate.amount)}</strong>.
                  </p>
                  <p className="text-sm font-medium text-ink/80 mb-4">
                    Next expected: {new Date(candidate.suggestedNextDue).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      createRecurring.mutate({
                        amount: candidate.amount,
                        description: candidate.merchantNorm,
                        frequency: candidate.inferredCadence.toUpperCase() as any,
                        startDate: candidate.suggestedNextDue.slice(0, 10),
                        type: "EXPENSE",
                      })
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Create Rule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RECURRING SECTION */}
      <section className="neo-surface p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-4">
          <div><h2 className="font-serif text-2xl font-bold">Recurring Obligations</h2><p className="mt-1 text-sm text-taupe">Assign a paying account, mark a due occurrence paid, or add these dates to your calendar.</p></div>
          <div className="flex flex-1 flex-col gap-3 md:flex-row xl:justify-end">
            <label className="relative flex-1 xl:max-w-xs">
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
            <Dialog open={isRecurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
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
                    <FormField
                      control={form.control}
                      name="accountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Paying account</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger></FormControl>
                            <SelectContent>{(accounts.data || []).filter((account) => account.currency === "INR").map((account) => <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>)}</SelectContent>
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
            <Button variant="outline" onClick={() => downloadCalendar()} disabled={!items.some((item) => item.isActive && item.nextRun)}><CalendarDays className="size-4" />Download all active bills</Button>
          </div>
        </div>

        {recurringQuery.error ? (
          <InlineErrorState
            title="Recurring obligations could not be loaded"
            description="The recurring rules request failed."
            onRetry={() => recurringQuery.refetch()}
          />
        ) : null}

        {recurringQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : !items.length ? (
          <ScreenEmptyState
            icon={CalendarClock}
            title="No obligations yet"
            description="Add your repeating bills and subscriptions so the product can treat future commitments as real, not optional trivia."
            cta={{ label: "Add first obligation", onClick: () => setRecurringDialogOpen(true) }}
          />
        ) : (
          <div className="overflow-hidden rounded-neo border-brutal bg-paper-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead>Paying account</TableHead>
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
                    <TableCell><select aria-label={`Paying account for ${item.description}`} value={item.accountId || ""} onChange={(event) => {
                      const nextAccountId = event.target.value;
                      if (!nextAccountId) return;
                      updateRecurring.mutate({ id: item.id, data: { accountId: nextAccountId } });
                    }} className="max-w-40 rounded border-brutal bg-paper-1 px-2 py-1 text-xs"><option value="">Unassigned</option>{(accounts.data || []).filter((account) => account.currency === "INR").map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "neutral"}>{item.isActive ? "Active" : "Paused"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.type === "EXPENSE" && item.accountId && item.isActive && item.nextRun ? <Button variant="outline" size="sm" onClick={() => onMarkPaid(item)}>Mark paid</Button> : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Open actions for ${item.description}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.isActive && item.nextRun ? <DropdownMenuItem onClick={() => downloadCalendar(item.id)}><CalendarDays className="mr-2 size-4" />Download this bill</DropdownMenuItem> : null}
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
          </div>
        )}
      </section>
      <BillPaymentDialog
        rule={paymentRule}
        occurrenceDate={paymentRule?.nextRun ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(paymentRule.nextRun)) : ""}
        open={Boolean(paymentRule)}
        onOpenChange={(open) => { if (!open) setPaymentRule(null); }}
      />
    </div>
  );
}

function ReminderCard({
  reminder,
  onComplete,
  onSnooze,
  onDismiss
}: {
  reminder: any;
  onComplete: (id: string) => void;
  onSnooze: (opts: {id: string; until: string}) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="rounded-neo border-brutal bg-paper-1 p-4 flex flex-col justify-between">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-semibold text-ink truncate">{reminder.title}</p>
          <span className="shrink-0 rounded-full border-brutal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-paper-2">
            {reminder.type.replace('_', ' ')}
          </span>
        </div>
        {reminder.description && <p className="text-sm text-taupe mb-3 line-clamp-2">{reminder.description}</p>}
        <p className="text-sm font-medium text-ink/80 mb-4">
          Due: {new Date(reminder.dueDate).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 mt-auto">
        <button onClick={() => onComplete(reminder.id)} className="flex-1 rounded border-brutal bg-success/20 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-success/30">
          Done
        </button>
        <button onClick={() => {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            onSnooze({ id: reminder.id, until: nextWeek.toISOString() });
        }} className="flex-1 rounded border-brutal bg-paper-2 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper-3">
          Snooze 7d
        </button>
        <button onClick={() => onDismiss(reminder.id)} className="flex-1 rounded border-brutal bg-paper-2 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper-3">
          Dismiss
        </button>
      </div>
    </div>
  )
}
