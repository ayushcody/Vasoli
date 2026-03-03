'use client';

import { Sidebar } from "@/components/sidebar";
import { useGoals, useCreateGoal, useGoalStats } from "@/lib/hooks/use-goals";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FadeInUp, 
  StaggerContainer, 
  StaggerItem,
  AnimatedProgress 
} from "@/components/motion/motion-wrapper";
import { 
  Target, 
  Plus, 
  TrendingUp, 
  Calendar, 
  CheckCircle2,
  PiggyBank,
  TargetIcon,
  Clock
} from "lucide-react";
import { EmptyState } from "@/components/motion/empty-state";
import { motion } from "framer-motion";

export default function GoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const { data: stats } = useGoalStats();
  const createGoal = useCreateGoal();
  
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetAmount: '',
    deadline: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createGoal.mutateAsync({
      name: formData.name,
      description: formData.description,
      targetAmount: parseFloat(formData.targetAmount),
      deadline: formData.deadline || undefined,
    });
    setIsCreating(false);
    setFormData({ name: '', description: '', targetAmount: '', deadline: '' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'PAUSED':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <TargetIcon className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'PAUSED':
        return 'bg-yellow-500';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <FadeInUp>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Financial Goals</h1>
                <p className="text-muted-foreground">
                  Track your savings goals and watch your progress
                </p>
              </div>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Goal
              </Button>
            </div>
          </FadeInUp>

          {/* Stats */}
          {stats && (
            <StaggerContainer className="grid gap-6 md:grid-cols-4 mb-8">
              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalGoals}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.completedGoals} completed
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
              
              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
                    <PiggyBank className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.totalSaved)}</div>
                    <p className="text-xs text-muted-foreground">
                      Across all goals
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
              
              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Target</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.totalTarget)}</div>
                    <p className="text-xs text-muted-foreground">
                      Combined goal targets
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
              
              <StaggerItem>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.averageProgress.toFixed(0)}%</div>
                    <p className="text-xs text-muted-foreground">
                      Across active goals
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>
          )}

          {/* Create Goal Form */}
          {isCreating && (
            <FadeInUp className="mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Goal</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="name">Goal Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., Emergency Fund"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="targetAmount">Target Amount</Label>
                        <Input
                          id="targetAmount"
                          type="number"
                          step="0.01"
                          value={formData.targetAmount}
                          onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="What are you saving for?"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deadline">Target Date (optional)</Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createGoal.isPending}>
                        {createGoal.isPending ? 'Creating...' : 'Create Goal'}
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

          {/* Goals Grid */}
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-muted" />
                  <CardContent className="h-32 bg-muted mt-4" />
                </Card>
              ))}
            </div>
          ) : goals && goals.length > 0 ? (
            <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {goals.map((goal) => (
                <StaggerItem key={goal.id}>
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(goal.status)}
                          <CardTitle className="text-lg">{goal.name}</CardTitle>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${getStatusColor(goal.status)}`}>
                          {goal.status}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{goal.progress.toFixed(0)}%</span>
                          </div>
                          <AnimatedProgress 
                            value={goal.progress} 
                            max={100}
                            variant={goal.progress >= 100 ? 'success' : 'default'}
                          />
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Saved</p>
                            <p className="text-lg font-semibold">{formatCurrency(goal.currentAmount)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Target</p>
                            <p className="text-lg font-semibold">{formatCurrency(goal.targetAmount)}</p>
                          </div>
                        </div>

                        {goal.daysRemaining !== undefined && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Clock className="h-4 w-4" />
                            <span>{goal.daysRemaining} days remaining</span>
                          </motion.div>
                        )}

                        {goal.status === 'ACTIVE' && (
                          <Button variant="outline" className="w-full" size="sm">
                            Add Contribution
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerContainer>
          ) : (
            <EmptyState
              icon={Target}
              title="No goals yet"
              description="Create your first financial goal to start tracking your savings progress."
              action={{
                label: 'Create Goal',
                onClick: () => setIsCreating(true),
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
