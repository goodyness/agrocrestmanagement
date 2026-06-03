import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { format, parseISO } from "date-fns";

type Task = {
  id: string; title: string; description: string | null; assigned_to: string | null;
  due_date: string | null; priority: string; status: string; category: string | null;
  notes: string | null; branch_id: string | null; completed_at: string | null;
};
type Worker = { id: string; name: string | null; email: string | null };

const STATUSES = ["todo", "in_progress", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"];

const TasksBoardSection = () => {
  const { currentBranchId } = useBranch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "", description: "", assigned_to: "", due_date: "",
    priority: "medium", category: "", notes: "",
  });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("farm_tasks").select("*").order("created_at", { ascending: false });
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setTasks((data || []) as Task[]);
    const { data: w } = await supabase.from("profiles").select("id, name, email").eq("role", "worker");
    setWorkers((w || []) as Worker[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [currentBranchId]);

  const handleCreate = async () => {
    if (!form.title) return toast.error("Title required");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("farm_tasks").insert({
      title: form.title, description: form.description || null,
      assigned_to: form.assigned_to || null, assigned_by: u.user?.id,
      due_date: form.due_date || null, priority: form.priority,
      category: form.category || null, notes: form.notes || null,
      status: "todo", branch_id: currentBranchId,
    });
    if (error) return toast.error(error.message);
    toast.success("Task created");
    setOpen(false);
    setForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "medium", category: "", notes: "" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("farm_tasks").update({
      status, completed_at: status === "done" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const priorityColor = (p: string) =>
    p === "urgent" ? "destructive" : p === "high" ? "default" : "secondary";

  const workerName = (id: string | null) => {
    if (!id) return "Unassigned";
    const w = workers.find(x => x.id === id);
    return w?.name || w?.email || "—";
  };

  const columns = STATUSES.map(s => ({ status: s, items: tasks.filter(t => t.status === s) }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Task Assignment Board</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Assign To</Label>
                  <Select value={form.assigned_to} onValueChange={v => setForm({ ...form, assigned_to: v })}>
                    <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                    <SelectContent>{workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name || w.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="cleaning, repair..." /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : (
          <div className="grid md:grid-cols-3 gap-4">
            {columns.map(col => (
              <div key={col.status} className="bg-muted/30 rounded-lg p-3 space-y-2 min-h-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold capitalize">{col.status.replace("_", " ")}</h3>
                  <Badge variant="outline">{col.items.length}</Badge>
                </div>
                {col.items.length === 0 && <p className="text-xs text-muted-foreground">No tasks</p>}
                {col.items.map(t => (
                  <div key={t.id} className="bg-card border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{t.title}</p>
                      <Badge variant={priorityColor(t.priority) as any} className="text-xs">{t.priority}</Badge>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>👤 {workerName(t.assigned_to)}</p>
                      {t.due_date && <p>📅 Due {format(parseISO(t.due_date), "MMM d")}</p>}
                      {t.category && <p>🏷️ {t.category}</p>}
                    </div>
                    <div className="flex gap-1">
                      {STATUSES.filter(s => s !== t.status).map(s => (
                        <Button key={s} size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus(t.id, s)}>
                          {s === "done" ? <CheckCircle2 className="h-3 w-3" /> : "→ " + s.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TasksBoardSection;
