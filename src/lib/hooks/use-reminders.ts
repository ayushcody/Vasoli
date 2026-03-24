import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reminderClient } from '@/lib/rpc/clients';
import { toast } from 'sonner';
import { Timestamp } from "@bufbuild/protobuf";

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  type: 'BILL_DUE' | 'GOAL_MILESTONE' | 'BUDGET_ALERT' | 'RECURRING_REVIEW' | 'CUSTOM';
  dueDate: string;
  status: 'PENDING' | 'SNOOZED' | 'COMPLETED' | 'DISMISSED';
  snoozeUntil?: string;
  metadata?: Record<string, unknown>;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  title: string;
  description?: string;
  type: 'BILL_DUE' | 'GOAL_MILESTONE' | 'BUDGET_ALERT' | 'RECURRING_REVIEW' | 'CUSTOM';
  dueDate: string;
  metadata?: Record<string, unknown>;
}

const REMINDERS_KEY = 'reminders';

function mapReminder(r: any): Reminder {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type as any,
    dueDate: r.dueDate?.toDate().toISOString() || new Date().toISOString(),
    status: r.status as any,
    snoozeUntil: r.snoozeUntil?.toDate().toISOString(),
    userId: r.userId,
    createdAt: r.createdAt?.toDate().toISOString() || new Date().toISOString(),
    updatedAt: r.updatedAt?.toDate().toISOString() || new Date().toISOString(),
  };
}

export function useReminders(options: { status?: string; upcoming?: boolean } = {}) {
  const { status, upcoming } = options;

  return useQuery({
    queryKey: [REMINDERS_KEY, { status, upcoming }],
    queryFn: async () => {
      const res = await reminderClient.listReminders({ status, upcoming });
      return res.reminders.map(mapReminder);
    },
  });
}

export function useReminder(id: string) {
  return useQuery({
    queryKey: [REMINDERS_KEY, id],
    queryFn: async () => {
      const res = await reminderClient.listReminders({}); // No direct GetReminder, filtering for now
      const r = res.reminders.find(r => r.id === id);
      if (!r) throw new Error("Reminder not found");
      return mapReminder(r);
    },
    enabled: !!id,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateReminderInput) => {
      const res = await reminderClient.createReminder({
        title: data.title,
        description: data.description,
        type: data.type,
        dueDate: Timestamp.fromDate(new Date(data.dueDate)),
      });
      return mapReminder(res.reminder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      toast.success('Reminder created');
    },
    onError: (error) => {
      toast.error('Failed to create reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateReminderInput> }) => {
      const res = await reminderClient.updateReminder({
        id,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? Timestamp.fromDate(new Date(data.dueDate)) : undefined,
      });
      return mapReminder(res.reminder);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, variables.id] });
      toast.success('Reminder updated');
    },
    onError: (error) => {
      toast.error('Failed to update reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await reminderClient.completeReminder({ id });
      return mapReminder(res.reminder);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, id] });
      toast.success('Reminder completed');
    },
    onError: (error) => {
      toast.error('Failed to complete reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useSnoozeReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, until }: { id: string; until: string }) => {
      const res = await reminderClient.snoozeReminder({ id, until: Timestamp.fromDate(new Date(until)) });
      return mapReminder(res.reminder);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, variables.id] });
      toast.success('Reminder snoozed');
    },
    onError: (error) => {
      toast.error('Failed to snooze reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDismissReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await reminderClient.dismissReminder({ id });
      return mapReminder(res.reminder);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY, id] });
      toast.success('Reminder dismissed');
    },
    onError: (error) => {
      toast.error('Failed to dismiss reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await reminderClient.deleteReminder({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REMINDERS_KEY] });
      toast.success('Reminder deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

export function useReminderStats() {
  return useQuery({
    queryKey: [REMINDERS_KEY, 'stats'],
    queryFn: async () => {
      // Stub or compute from list
      const res = await reminderClient.listReminders({});
      const reminders = res.reminders;
      return {
        total: reminders.length,
        pending: reminders.filter(r => r.status === 'PENDING').length,
        snoozed: reminders.filter(r => r.status === 'SNOOZED').length,
        completed: reminders.filter(r => r.status === 'COMPLETED').length,
        overdue: reminders.filter(r => r.status === 'PENDING' && r.dueDate && r.dueDate.toDate() < new Date()).length,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}
