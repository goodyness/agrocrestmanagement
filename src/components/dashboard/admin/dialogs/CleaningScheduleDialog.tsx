import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar, Settings } from "lucide-react";
import { toast } from "sonner";

interface CleaningScheduleDialogProps {
  onSuccess: () => void;
}

const CleaningScheduleDialog = ({ onSuccess }: CleaningScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState<any>(null);
  const [startDate, setStartDate] = useState("");
  const [intervalDays, setIntervalDays] = useState(5);
  const [tasks, setTasks] = useState("Flush gutters\nSweep farm\nRemove cobwebs");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      fetchSchedule();
    }
  }, [open]);

  const fetchSchedule = async () => {
    const { data } = await supabase
      .from("cleaning_schedules")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setSchedule(data);
      setStartDate(data.start_date);
      setIntervalDays(data.interval_days);
      setTasks((data.tasks as string[] || []).join("\n"));
      setIsActive(data.is_active);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const tasksArray = tasks.split("\n").filter(t => t.trim());

    if (schedule) {
      const { error } = await supabase
        .from("cleaning_schedules")
        .update({
          start_date: startDate,
          interval_days: intervalDays,
          tasks: tasksArray,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

      if (error) {
        toast.error("Failed to update schedule");
      } else {
        toast.success("Cleaning schedule updated!");
        setOpen(false);
        onSuccess();
      }
    } else {
      const { error } = await supabase
        .from("cleaning_schedules")
        .insert({
          start_date: startDate,
          interval_days: intervalDays,
          tasks: tasksArray,
          is_active: isActive,
        });

      if (error) {
        toast.error("Failed to create schedule");
      } else {
        toast.success("Cleaning schedule created!");
        setOpen(false);
        onSuccess();
      }
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Cleaning Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cleaning Schedule Settings
          </DialogTitle>
          <DialogDescription>Configure farm cleaning schedule and reminders</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">First cleaning date (schedule repeats from here)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Interval (days)</Label>
            <Input
              id="interval"
              type="number"
              min="1"
              max="30"
              value={intervalDays}
              onChange={(e) => setIntervalDays(parseInt(e.target.value) || 5)}
              required
            />
            <p className="text-xs text-muted-foreground">How often cleaning should occur</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tasks">Cleaning Tasks</Label>
            <Textarea
              id="tasks"
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              placeholder="Enter tasks, one per line..."
              className="h-24"
            />
            <p className="text-xs text-muted-foreground">One task per line</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="active">Schedule Active</Label>
              <p className="text-xs text-muted-foreground">Enable/disable cleaning reminders</p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : schedule ? "Update Schedule" : "Create Schedule"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CleaningScheduleDialog;
