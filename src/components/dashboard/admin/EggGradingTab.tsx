import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Egg, Plus, TrendingUp, AlertTriangle } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { logActivity } from "@/lib/activityLogger";

const COLORS = ["#94a3b8", "#60a5fa", "#34d399", "#a78bfa", "#f87171"];

const EggGradingTab = () => {
  const { currentBranchId } = useBranch();
  const [records, setRecords] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    batch_id: "",
    small_count: 0,
    medium_count: 0,
    large_count: 0,
    extra_large_count: 0,
    cracked_count: 0,
    notes: "",
  });

  useEffect(() => {
    fetchRecords();
    fetchBatches();
  }, [currentBranchId]);

  const fetchRecords = async () => {
    let q = supabase.from("egg_grading_records").select("*, profiles:recorded_by(name), livestock_batches:batch_id(species, species_type)").order("date", { ascending: false });
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data } = await q;
    setRecords(data || []);
  };

  const fetchBatches = async () => {
    let q = supabase.from("livestock_batches").select("id, species, species_type, current_quantity").eq("is_active", true);
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data } = await q;
    setBatches(data || []);
  };

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const total = form.small_count + form.medium_count + form.large_count + form.extra_large_count + form.cracked_count;
    const { error } = await supabase.from("egg_grading_records").insert({
      ...form,
      batch_id: form.batch_id || null,
      total_eggs: total,
      recorded_by: user.id,
      branch_id: currentBranchId || null,
    });
    if (error) { toast.error("Failed to save"); return; }
    toast.success("Egg grading recorded!");
    logActivity("create_egg_grading", "egg_grading", undefined, { total, cracked: form.cracked_count }, currentBranchId);
    setDialogOpen(false);
    setForm({ date: new Date().toISOString().split("T")[0], batch_id: "", small_count: 0, medium_count: 0, large_count: 0, extra_large_count: 0, cracked_count: 0, notes: "" });
    fetchRecords();
  };

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({ totalItems: records.length, itemsPerPage: 15 });
  const paginatedRecords = records.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  // Aggregate stats
  const totals = records.reduce((acc, r) => ({
    small: acc.small + r.small_count,
    medium: acc.medium + r.medium_count,
    large: acc.large + r.large_count,
    xl: acc.xl + r.extra_large_count,
    cracked: acc.cracked + r.cracked_count,
    total: acc.total + r.total_eggs,
  }), { small: 0, medium: 0, large: 0, xl: 0, cracked: 0, total: 0 });

  const pieData = [
    { name: "Small", value: totals.small },
    { name: "Medium", value: totals.medium },
    { name: "Large", value: totals.large },
    { name: "Extra Large", value: totals.xl },
    { name: "Cracked", value: totals.cracked },
  ].filter(d => d.value > 0);

  const crackedPct = totals.total > 0 ? ((totals.cracked / totals.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Egg className="h-6 w-6 text-primary" />
            Egg Grading & Quality
          </h2>
          <p className="text-muted-foreground">Track egg sizes and quality metrics</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Record Grading</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Egg Grading</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                <div>
                  <Label>Batch (optional)</Label>
                  <Select value={form.batch_id} onValueChange={v => setForm({ ...form, batch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                    <SelectContent>
                      {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.species} {b.species_type || ""} ({b.current_quantity})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Small</Label><Input type="number" min={0} value={form.small_count} onChange={e => setForm({ ...form, small_count: +e.target.value })} /></div>
                <div><Label>Medium</Label><Input type="number" min={0} value={form.medium_count} onChange={e => setForm({ ...form, medium_count: +e.target.value })} /></div>
                <div><Label>Large</Label><Input type="number" min={0} value={form.large_count} onChange={e => setForm({ ...form, large_count: +e.target.value })} /></div>
                <div><Label>Extra Large</Label><Input type="number" min={0} value={form.extra_large_count} onChange={e => setForm({ ...form, extra_large_count: +e.target.value })} /></div>
              </div>
              <div><Label>Cracked / Damaged</Label><Input type="number" min={0} value={form.cracked_count} onChange={e => setForm({ ...form, cracked_count: +e.target.value })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" /></div>
              <Button onClick={handleSubmit} className="w-full">Save Grading</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Small", value: totals.small, color: "text-muted-foreground" },
          { label: "Medium", value: totals.medium, color: "text-blue-500" },
          { label: "Large", value: totals.large, color: "text-green-500" },
          { label: "Extra Large", value: totals.xl, color: "text-purple-500" },
          { label: "Cracked", value: totals.cracked, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Size Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">No data yet</p>}
          </CardContent>
        </Card>

        {/* Quality summary */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Quality Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Eggs Graded</span>
              <Badge variant="secondary" className="text-lg">{totals.total}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Cracked Rate</span>
              <Badge variant={Number(crackedPct) > 3 ? "destructive" : "default"} className="text-lg">
                {crackedPct}%
              </Badge>
            </div>
            {Number(crackedPct) > 3 && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive">Cracked rate exceeds 3% — check handling & transport</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm">Premium Grade (L+XL)</span>
              <span className="font-bold">{totals.total > 0 ? (((totals.large + totals.xl) / totals.total) * 100).toFixed(1) : 0}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records table */}
      <Card>
        <CardHeader>
          <CardTitle>Grading Records</CardTitle>
          <CardDescription>{records.length} total records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Small</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead>Large</TableHead>
                <TableHead>XL</TableHead>
                <TableHead>Cracked</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{r.small_count}</TableCell>
                  <TableCell>{r.medium_count}</TableCell>
                  <TableCell>{r.large_count}</TableCell>
                  <TableCell>{r.extra_large_count}</TableCell>
                  <TableCell className={r.cracked_count > 0 ? "text-destructive font-medium" : ""}>{r.cracked_count}</TableCell>
                  <TableCell className="font-medium">{r.total_eggs}</TableCell>
                  <TableCell>{r.profiles?.name || "Unknown"}</TableCell>
                </TableRow>
              ))}
              {paginatedRecords.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No records yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} getPageNumbers={getPageNumbers} />
        </CardContent>
      </Card>
    </div>
  );
};

export default EggGradingTab;
