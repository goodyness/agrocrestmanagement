import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brush, Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";

interface CleaningSchedule {
  id: string;
  branch_id: string | null;
  start_date: string;
  interval_days: number;
  tasks: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branch?: { name: string } | null;
}

interface Branch {
  id: string;
  name: string;
}

const CleaningManagementTab = () => {
  const { currentBranch } = useBranch();
  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CleaningSchedule | null>(null);
  
  // Form state
  const [formBranchId, setFormBranchId] = useState<string>("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formIntervalDays, setFormIntervalDays] = useState(5);
  const [formTasks, setFormTasks] = useState("Flush gutters\nSweep farm\nRemove cobwebs");
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    fetchSchedules();
    fetchBranches();
  }, [currentBranch]);

  const fetchBranches = async () => {
    const { data } = await supabase
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setBranches(data || []);
  };

  const fetchSchedules = async () => {
    setLoading(true);
    let query = supabase
      .from("cleaning_schedules")
      .select("*, branch:branches(name)")
      .order("created_at", { ascending: false });

    if (currentBranch) {
      query = query.eq("branch_id", currentBranch.id);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load cleaning schedules");
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingSchedule(null);
    setFormBranchId("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormIntervalDays(5);
    setFormTasks("Flush gutters\nSweep farm\nRemove cobwebs");
    setFormIsActive(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (schedule: CleaningSchedule) => {
    setEditingSchedule(schedule);
    setFormBranchId(schedule.branch_id || "");
    setFormStartDate(schedule.start_date);
    setFormIntervalDays(schedule.interval_days);
    setFormTasks((schedule.tasks || []).join("\n"));
    setFormIsActive(schedule.is_active);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const tasksArray = formTasks.split("\n").filter(t => t.trim());
    const scheduleData = {
      branch_id: formBranchId || null,
      start_date: formStartDate,
      interval_days: formIntervalDays,
      tasks: tasksArray,
      is_active: formIsActive,
      updated_at: new Date().toISOString(),
    };

    if (editingSchedule) {
      const { error } = await supabase
        .from("cleaning_schedules")
        .update(scheduleData)
        .eq("id", editingSchedule.id);

      if (error) {
        toast.error("Failed to update schedule");
      } else {
        toast.success("Cleaning schedule updated!");
        setDialogOpen(false);
        fetchSchedules();
      }
    } else {
      const { error } = await supabase
        .from("cleaning_schedules")
        .insert(scheduleData);

      if (error) {
        toast.error("Failed to create schedule");
      } else {
        toast.success("Cleaning schedule created!");
        setDialogOpen(false);
        fetchSchedules();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cleaning schedule?")) return;
    
    const { error } = await supabase
      .from("cleaning_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete schedule");
    } else {
      toast.success("Cleaning schedule deleted!");
      fetchSchedules();
    }
  };

  const toggleScheduleStatus = async (schedule: CleaningSchedule) => {
    const { error } = await supabase
      .from("cleaning_schedules")
      .update({ is_active: !schedule.is_active, updated_at: new Date().toISOString() })
      .eq("id", schedule.id);

    if (error) {
      toast.error("Failed to update schedule status");
    } else {
      toast.success(schedule.is_active ? "Schedule deactivated" : "Schedule activated");
      fetchSchedules();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brush className="h-5 w-5 text-primary" />
              Cleaning Schedules
            </CardTitle>
            <CardDescription>
              Configure cleaning schedules for each branch
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {editingSchedule ? "Edit Cleaning Schedule" : "Create Cleaning Schedule"}
                </DialogTitle>
                <DialogDescription>
                  Configure cleaning schedule and reminders for a branch
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={formBranchId} onValueChange={setFormBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Branches</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Leave empty for a global schedule</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
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
                    value={formIntervalDays}
                    onChange={(e) => setFormIntervalDays(parseInt(e.target.value) || 5)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">How often cleaning should occur</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tasks">Cleaning Tasks</Label>
                  <Textarea
                    id="tasks"
                    value={formTasks}
                    onChange={(e) => setFormTasks(e.target.value)}
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
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                </div>

                <Button type="submit" className="w-full">
                  {editingSchedule ? "Update Schedule" : "Create Schedule"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cleaning schedules configured. Click "Add Schedule" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.branch?.name || "All Branches"}
                      </TableCell>
                      <TableCell>
                        {new Date(schedule.start_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>Every {schedule.interval_days} days</TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate">
                          {(schedule.tasks || []).join(", ") || "No tasks"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() => toggleScheduleStatus(schedule)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(schedule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(schedule.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CleaningManagementTab;
