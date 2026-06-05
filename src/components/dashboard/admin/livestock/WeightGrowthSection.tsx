import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Scale, TrendingUp, Plus } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const ITEMS_PER_PAGE = 15;

const WeightGrowthSection = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    batch_id: "",
    weight_date: format(new Date(), "yyyy-MM-dd"),
    sample_size: "1",
    average_weight_g: "",
    target_weight_g: "",
    notes: "",
  });

  const fetchData = async () => {
    let bq = supabase.from("livestock_batches").select("id, species, stage, age_weeks").eq("is_active", true).order("created_at", { ascending: false });
    if (currentBranchId) bq = bq.eq("branch_id", currentBranchId);
    const { data: batchesData } = await bq;

    let rq = supabase
      .from("batch_weight_records")
      .select("*, livestock_batches(species, stage)")
      .order("weight_date", { ascending: false });
    if (currentBranchId) rq = rq.eq("branch_id", currentBranchId);
    const { data: recordsData } = await rq;

    setBatches(batchesData || []);
    setRecords(recordsData || []);
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const chartData = useMemo(() => {
    const byDate: Record<string, any> = {};
    records.forEach((r) => {
      const d = format(new Date(r.weight_date), "MMM dd");
      if (!byDate[d]) byDate[d] = { date: d };
      const label = `${r.livestock_batches?.species || "Batch"} ${r.livestock_batches?.stage || ""}`;
      byDate[d][label] = Number(r.average_weight_g);
    });
    return Object.values(byDate).reverse();
  }, [records]);

  const batchColors = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "#8884d8"];
  const uniqueLabels = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => {
      s.add(`${r.livestock_batches?.species || "Batch"} ${r.livestock_batches?.stage || ""}`);
    });
    return Array.from(s);
  }, [records]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batch_id || !form.average_weight_g) {
      toast.error("Batch and average weight are required");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("batch_weight_records").insert({
      batch_id: form.batch_id,
      weight_date: form.weight_date,
      sample_size: parseInt(form.sample_size) || 1,
      average_weight_g: parseFloat(form.average_weight_g),
      target_weight_g: form.target_weight_g ? parseFloat(form.target_weight_g) : null,
      notes: form.notes || null,
      branch_id: currentBranchId,
    } as any);
    if (error) {
      toast.error("Failed to save weight record");
    } else {
      toast.success("Weight record added");
      setOpen(false);
      setForm({ batch_id: "", weight_date: format(new Date(), "yyyy-MM-dd"), sample_size: "1", average_weight_g: "", target_weight_g: "", notes: "" });
      fetchData();
    }
    setLoading(false);
  };

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: records.length,
    itemsPerPage: ITEMS_PER_PAGE,
  });
  const paginated = records.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Weight-Growth Curves
          </h3>
          <p className="text-sm text-muted-foreground">Periodic weigh-ins and average daily gain tracking</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Weigh-in
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Batch Weight</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Batch</Label>
                <Select value={form.batch_id} onValueChange={(v) => setForm((f) => ({ ...f, batch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.species} — {b.stage} (wk {b.age_weeks})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.weight_date} onChange={(e) => setForm((f) => ({ ...f, weight_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sample Size</Label>
                  <Input type="number" min={1} value={form.sample_size} onChange={(e) => setForm((f) => ({ ...f, sample_size: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Avg Weight (g)</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 1850" value={form.average_weight_g} onChange={(e) => setForm((f) => ({ ...f, average_weight_g: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Target Weight (g) — optional</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 2000" value={form.target_weight_g} onChange={(e) => setForm((f) => ({ ...f, target_weight_g: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any observations..." />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Save Weight Record"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Growth Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: "g", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                {uniqueLabels.map((label, i) => (
                  <Line key={label} type="monotone" dataKey={label} stroke={batchColors[i % batchColors.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weight Records</CardTitle>
          <CardDescription>{records.length} total records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Avg Weight (g)</TableHead>
                <TableHead className="text-right">Target (g)</TableHead>
                <TableHead className="text-right">Sample</TableHead>
                <TableHead className="hidden sm:table-cell">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No weight records yet</TableCell>
                </TableRow>
              ) : (
                paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.weight_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{r.livestock_batches?.species || "—"} {r.livestock_batches?.stage || ""}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r.average_weight_g).toFixed(1)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.target_weight_g ? Number(r.target_weight_g).toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-right">{r.sample_size}</TableCell>
                    <TableCell className="hidden sm:table-cell max-w-xs truncate">{r.notes || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            getPageNumbers={getPageNumbers}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default WeightGrowthSection;
