'use client';

import { Sidebar } from "@/components/sidebar";
import { 
  useReminders, 
  useCreateReminder, 
  useCompleteReminder, 
  useSnoozeReminder,
  useDismissReminder,
  useDeleteReminder,
  Reminder 
} from "@/lib/hooks/use-reminders";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FadeInUp, 
  StaggerContainer, 
  StaggerItem,
} from "@/components/motion/motion-wrapper";
import { 
  Bell, 
  Plus, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Calendar,
  AlertCircle,
  Target,
  Wallet,
  Repeat,
  Trash2,
  Pause
} from "lucide-react";
import { EmptyState } from "@/components/motion/empty-state";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const reminderTypeConfig = {
  BILL_DUE: { icon: Wallet, color: 'bg-orange-500', label: 'Bill Due' },
  GOAL_MILESTONE: { icon: Target, color: 'bg-green-500', label: 'Goal Milestone' },
  BUDGET_ALERT: { icon: AlertCircle, color: 'bg-red-500', label: 'Budget Alert' },
  RECURRING_REVIEW: { icon: Repeat, color: 'bg-blue-500', label: 'Recurring Review' },
  CUSTOM: { icon: Bell, color: 'bg-purple-500', label: 'Custom' },
};

const statusConfig = {
  PENDING: { color: 'bg-yellow-500', label: 'Pending' },
  SNOOZED: { color: 'bg-blue-500', label: 'Snoozed' },
  COMPLETED: { color: 'bg-green-500', label: 'Completed' },
  DISMISSED: { color: 'bg-gray-500', label: 'Dismissed' },
};

export default function RemindersPage() {
  const { data: reminders, isLoading } = useReminders();
  const { data: upcomingReminders } = useReminders({ upcoming: true });
  const createReminder = useCreateReminder();
  const completeReminder = useCompleteReminder();
  const snoozeReminder = useSnoozeReminder();
  const dismissReminder = useDismissReminder();
  const deleteReminder = useDeleteReminder();
  
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'CUSTOM' as const,
    dueDate: '',
  });
  const [filter, setFilter] = useState<string>('ALL');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createReminder.mutateAsync({
      title: formData.title,
      description: formData.description,
      type: formData.type,
      dueDate: formData.dueDate,
    });
    setIsCreating(false);
    setFormData({ title: '', description: '', type: 'CUSTOM', dueDate: '' });
  };

  const handleSnooze = async (id: string) => {
    const snoozeUntil = new Date();
    snoozeUntil.setHours(snoozeUntil.getHours() + 24);
    await snoozeReminder.mutateAsync({ id, until: snoozeUntil.toISOString() });
  };

  const filteredReminders = reminders?.filter(r => 
    filter === 'ALL' || r.status === filter
  );

  const renderReminderCard = (reminder: Reminder & { daysUntil: number; isOverdue: boolean }) => {
    const typeConfig = reminderTypeConfig[reminder.type as keyof typeof reminderTypeConfig] || reminderTypeConfig.CUSTOM;
    const statusStyle = statusConfig[reminder.status as keyof typeof statusConfig] || statusConfig.PENDING;
    const TypeIcon = typeConfig.icon;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <Card className={`overflow-hidden transition-shadow hover:shadow-lg ${reminder.isOverdue ? 'border-red-300' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full ${typeConfig.color} flex items-center justify-center flex-shrink-0`}>
                <TypeIcon className="h-5 w-5 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold truncate">{reminder.title}</h3>
                    {reminder.description && (
                      <p className="text-sm text-muted-foreground mt-1">{reminder.description}</p>
                    )}
                  </div>
                  <Badge className={statusStyle.color}>
                    {statusStyle.label}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(reminder.dueDate)}</span>
                  </div>
                  {reminder.daysUntil > 0 && reminder.status === 'PENDING' && (
                    <span className="text-blue-600">{reminder.daysUntil} days left</span>
                  )}
                  {reminder.isOverdue && (
                    <span className="text-red-600 font-medium">Overdue</span>
                  )}
                </div>

                {reminder.status === 'PENDING' && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => completeReminder.mutate(reminder.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSnooze(reminder.id)}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Snooze
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissReminder.mutate(reminder.id)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteReminder.mutate(reminder.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <FadeInUp>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Reminders</h1>
                <p className="text-muted-foreground">
                  Stay on top of your financial commitments
                </p>
              </div>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Reminder
              </Button>
            </div>
          </FadeInUp>

          {/* Upcoming Section */}
          {upcomingReminders && upcomingReminders.length > 0 && (
            <FadeInUp className="mb-8">
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    Upcoming This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingReminders.slice(0, 3).map((reminder) => (
                      <div 
                        key={reminder.id} 
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${reminderTypeConfig[reminder.type as keyof typeof reminderTypeConfig]?.color || 'bg-gray-400'}`} />
                          <span className="font-medium">{reminder.title}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(reminder.dueDate)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </FadeInUp>
          )}

          {/* Create Form */}
          {isCreating && (
            <FadeInUp className="mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Reminder</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Pay electricity bill"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Additional details..."
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="type">Type</Label>
                        <select
                          id="type"
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="BILL_DUE">Bill Due</option>
                          <option value="GOAL_MILESTONE">Goal Milestone</option>
                          <option value="BUDGET_ALERT">Budget Alert</option>
                          <option value="RECURRING_REVIEW">Recurring Review</option>
                          <option value="CUSTOM">Custom</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createReminder.isPending}>
                        {createReminder.isPending ? 'Creating...' : 'Create Reminder'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </FadeInUp>
          )}

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {['ALL', 'PENDING', 'SNOOZED', 'COMPLETED'].map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>

          {/* Reminders List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-24" />
                </Card>
              ))}
            </div>
          ) : filteredReminders && filteredReminders.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <div className="space-y-4">
                {filteredReminders.map((reminder) => renderReminderCard(reminder as any))}
              </div>
            </AnimatePresence>
          ) : (
            <EmptyState
              icon={Bell}
              title="No reminders"
              description={
                filter === 'ALL' 
                  ? "Create reminders to stay on top of bills, goals, and budgets."
                  : `No ${filter.toLowerCase()} reminders found.`
              }
              action={filter === 'ALL' ? {
                label: 'Create Reminder',
                onClick: () => setIsCreating(true),
              } : undefined}
            />
          )}
        </div>
      </main>
    </div>
  );
}
