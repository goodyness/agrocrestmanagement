import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Baby, Plus, Dna } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import { format } from "date-fns";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const ITEMS_PER_PAGE = 15;

const BreedingSection = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    sire_batch_id: "",
    dam_batch_id: "",
    hatch_date: "",
    eggs_set: "",
    eggs_fertile: "",
    eggs_hatched: "",
    chick_batch_id: "",
    lineage_notes: "",
    status: "active" as "active" | "completed" | "cancelled",
  });

  const fetchData = async () => {
    let bq = supabase.from("livestock_batches").select("id, species, stage, age_weeks").eq("is_active", true).order("created_at", { ascending: false });
    if (currentBranchId) bq = bq.eq("branch_id", currentBranchId);
    const { data: batchesData } = await bq;

    let rq = supabase
      .from("breeding_records")
      .select("*, sire:sire_batch_id(species, stage), dam:dam_batch_id(species, stage), chick:chick_batch_id(species, stage)")
      .order("created_at", { ascending: false });
    if (currentBranchId) rq = rq.eq("branch_id", currentBranchId);
    const { data: recordsData } = await rq;

    setBatches(batchesData || []);
    setRecords(recordsData || []);
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sire_batch_id || !form.dam_batch_id) {
      toast.error("Sire and dam batches are required");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("breeding_records").insert({
      sire_batch_id: form.sire_batch_id || null,
      dam_batch_id: form.dam_batch_id || null,
      hatch_date: form.hatch_date || null,
      eggs_set: parseInt(form.eggs_set) || 0,
      eggs_fertile: parseInt(form.eggs_fertile) || 0,
      eggs_hatched: parseInt(form.eggs_hatched) || 0,
      chick_batch_id: form.chick_batch_id || null,
      lineage_notes: form.lineage_notes || null,
      status: form.status,
      branch_id: currentBranchId,
    } as any);
    if (error) {
      toast.error("Failed to save breeding record");
    } else {
      toast.success("Breeding record added");
      setOpen(false);
      setForm({ sire_batch_id: "", dam_batch_id: "", hatch_date: "", eggs_set: "", eggs_fertile: "", eggs_hatched: "", chick_batch_id: "", lineage_notes: "", status: "active" });
      fetchData();
    }
    setLoading(false);
  };

  const fertilityRate = (record: any) => {
    const set = record.eggs_set || 0;
    return set > 0 ? Math.round(((record.eggs_fertile || 0) / set) * 100) : 0;
  };

  const hatchRate = (record: any) => {
    const fertile = record.eggs_fertile || 0;
    return fertile > 0 ? Math.round(((record.eggs_hatched || 0) / fertile) * 100) : 0;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="default" className="text-xs">Active</Badge>;
      case "completed": return <Badge variant="secondary" className="text-xs">Completed</Badge>;
      case "cancelled": return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
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
            <Dna className="h-5 w-5 text-primary" />
            Breeding & Pedigree
          </h3>
          <p className="text-sm text-muted-foreground">Track parent stock, hatch dates, and lineage</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Breeding Record
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Breeding Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Sire Batch</Label>
                  <Select value={form.sire_batch_id} onValueChange={(v) => setForm((f) => ({ ...f, sire_batch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select sire" /></SelectTrigger>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.species} — {b.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dam Batch</Label>
                  <Select value={form.dam_batch_id} onValueChange={(v) => setForm((f) => ({ ...f, dam_batch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select dam" /></SelectTrigger>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.species} — {b.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Hatch Date</Label>
                  <Input type="date" value={form.hatch_date} onChange={(e) => setForm((f) => ({ ...f, hatch_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Eggs Set</Label>
                  <Input type="number" min={0} value={form.eggs_set} onChange={(e) => setForm((f) => ({ ...f, eggs_set: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Fertile</Label>
                  <Input type="number" min={0} value={form.eggs_fertile} onChange={(e) => setForm((f) => ({ ...f, eggs_fertile: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Hatched</Label>
                  <Input type="number" min={0} value={form.eggs_hatched} onChange={(e) => setForm((f) => ({ ...f, eggs_hatched: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Chick Batch (resulting)</Label>
                <Select value={form.chick_batch_id} onValueChange={(v) => setForm((f) => ({ ...f, chick_batch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Link to chick batch (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.species} — {b.stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lineage Notes</Label>
                <Textarea value={form.lineage_notes} onChange={(e) => setForm((f) => ({ ...f, lineage_notes: e.target.value }))} placeholder="Notes on lineage, traits, selection criteria..." />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Save Breeding Record"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Records</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{records.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Avg Fertility</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {records.length > 0 ? Math.round(records.reduce((s, r) => s + fertilityRate(r), 0) / records.length) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Avg Hatch Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {records.length > 0 ? Math.round(records.reduce((s, r) => s + hatchRate(r), 0) / records.length) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Breeding Records</CardTitle>
          <CardDescription>{records.length} total records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sire</TableHead>
                  <TableHead>Dam</TableHead>
                  <TableHead>Hatch Date</TableHead>
                  <TableHead className="text-right">Set</TableHead>
                  <TableHead className="text-right">Fertile</TableHead>
                  <TableHead className="text-right">Hatched</TableHead>
                  <TableHead>Fertility</TableHead>
                  <TableHead>Hatch</TableHead>
                  <TableHead>Chick Batch</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">No breeding records yet</TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.sire?.species || "—"} {r.sire?.stage || ""}</TableCell>
                      <TableCell className="text-sm">{r.dam?.species || "—"} {r.dam?.stage || ""}</TableCell>
                      <TableCell>{r.hatch_date ? format(new Date(r.hatch_date), "MMM dd, yyyy") : "—"}</TableCell>
                      <TableCell className="text-right">{r.eggs_set}</TableCell>
                      <TableCell className="text-right">{r.eggs_fertile}</TableCell>
                      <TableCell className="text-right">{r.eggs_hatched}</TableCell>
                      <TableCell>{fertilityRate(r)}%</TableCell>
                      <TableCell>{hatchRate(r)}%</TableCell>
                      <TableCell className="text-sm">{r.chick?.species || "—"} {r.chick?.stage || ""}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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

export default BreedingSection;
