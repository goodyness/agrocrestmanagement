import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Sun, Moon, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DailyTaskChecklistProps {
  userId: string;
  branchId: string | null;
}

interface TaskItem {
  id?: string;
  task_name: string;
  task_period: string;
  is_completed: boolean;
  template_id?: string;
}

const DailyTaskChecklist = ({ userId, branchId }: DailyTaskChecklistProps) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    loadTasks();
  }, [userId, branchId]);

  const loadTasks = async () => {
    setLoading(true);

    // Get today's checklist items
    const { data: existing } = await supabase
      .from("daily_task_checklists")
      .select("*")
      .eq("worker_id", userId)
      .eq("task_date", today);

    if (existing && existing.length > 0) {
      setTasks(existing.map((t) => ({
        id: t.id,
        task_name: t.task_name,
        task_period: t.task_period,
        is_completed: t.is_completed,
      })));
    } else {
      // Load templates and create today's tasks
      const { data: templates } = await supabase
        .from("task_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (templates && templates.length > 0) {
        const newTasks = templates.map((t) => ({
          worker_id: userId,
          branch_id: branchId,
          task_date: today,
          task_name: t.task_name,
          task_period: t.task_period,
          is_completed: false,
        }));

        const { data: inserted } = await supabase
          .from("daily_task_checklists")
          .insert(newTasks)
          .select();

        if (inserted) {
          setTasks(inserted.map((t) => ({
            id: t.id,
            task_name: t.task_name,
            task_period: t.task_period,
            is_completed: t.is_completed,
          })));
        }
      }
    }
    setLoading(false);
  };

  const toggleTask = async (index: number) => {
    const task = tasks[index];
    if (!task.id) return;

    const newCompleted = !task.is_completed;
    const { error } = await supabase
      .from("daily_task_checklists")
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (error) {
      toast.error("Failed to update task");
      return;
    }

    const updated = [...tasks];
    updated[index] = { ...task, is_completed: newCompleted };
    setTasks(updated);
  };

  const morningTasks = tasks.filter((t) => t.task_period === "morning");
  const eveningTasks = tasks.filter((t) => t.task_period === "evening");
  const completedCount = tasks.filter((t) => t.is_completed).length;
  const totalCount = tasks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  if (loading) return null;

  return (
    <Card className={allDone ? "border-success/30 bg-success/5" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Daily Task Checklist
          <Badge variant="outline" className="ml-auto">
            {completedCount}/{totalCount}
          </Badge>
          {allDone && <CheckCircle className="h-4 w-4 text-success" />}
        </CardTitle>
        <CardDescription className="text-xs">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Morning Tasks */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sun className="h-4 w-4 text-warning" />
            <span className="text-xs font-semibold text-foreground uppercase">Morning</span>
          </div>
          <div className="space-y-2">
            {morningTasks.map((task, i) => {
              const globalIdx = tasks.findIndex((t) => t.id === task.id);
              return (
                <label key={task.id} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => toggleTask(globalIdx)}
                  />
                  <span className={`text-sm ${task.is_completed ? "line-through text-muted-foreground" : "text-foreground"} group-hover:text-primary transition-colors`}>
                    {task.task_name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Evening Tasks */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Moon className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase">Evening</span>
          </div>
          <div className="space-y-2">
            {eveningTasks.map((task) => {
              const globalIdx = tasks.findIndex((t) => t.id === task.id);
              return (
                <label key={task.id} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => toggleTask(globalIdx)}
                  />
                  <span className={`text-sm ${task.is_completed ? "line-through text-muted-foreground" : "text-foreground"} group-hover:text-primary transition-colors`}>
                    {task.task_name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyTaskChecklist;
