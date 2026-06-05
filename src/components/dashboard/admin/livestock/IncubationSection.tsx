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
import { Egg, Plus, Thermometer } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const ITEMS_PER_PAGE = 15;

const IncubationSection = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<any[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    breeding_record_id: "",
    incubator_id: "",
    set_date: format(new Date(), "yyyy-MM-dd"),
    eggs_set: "",
    candling_date: "",
    fertile_count: "",
    infertile_count: "",
    dead_in_shell: "",
    hatched_count: "",
    hatch_date: "",
    transfer_batch_id: "",
    notes: "",
  });

  const fetchData = async () => {
    let bq = supabase.from("livestock_batches").select("id, species, stage").eq("is_active", true).order("created_at", { ascending: false });
    if (currentBranchId) bq = bq.eq("branch_id", currentBranchId);
    const { data: batchesData } = await bq;

    let brq = supabase.from("breeding_records").select("id, eggs_set, eggs_fertile, eggs_hatched").order("created_at", { ascending: false });
    if (currentBranchId) brq = brq.eq("branch_id", currentBranchId);
    const { data: breedingData } = await brq;

    let rq = supabase
      .from("incubation_records")
      .select("*, breeding_record:breeding_record_id(id), transfer:transfer_batch_id(species, stage)")
      .order("set_date", { ascending: false });
    if (currentBranchId) rq = rq.eq("branch_id", currentBranchId);
    const { data: recordsData } = await rq;

    setBatches(batchesData || []);
    setBreedingRecords(breedingData || []);
    setRecords(recordsData || []);
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.set_date || !form.eggs_set) {
      toast.error("Set date and eggs set are required");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("incubation_records").insert({
      breeding_record_id: form.breeding_record_id || null,
      incubator_id: form.incubator_id || null,
      set_date: form.set_date,
      eggs_set: parseInt(form.eggs_set) || 0,
      candling_date: form.candling_date || null,
      fertile_count: form.fertile_count ? parseInt(form.fertile_count) : 0,
      infertile_count: form.infertile_count ? parseInt(form.infertile_count) : 0,
      dead_in_shell: form.dead_in_shell ? parseInt(form.dead_in_shell) : 0,
      hatched_count: form.hatched_count ? parseInt(form.hatched_count) : 0,
      hatch_date: form.hatch_date || null,
      transfer_batch_id: form.transfer_batch_id || null,
      notes: form.notes || null,
      branch_id: currentBranchId,
    } as any);
    if (error) {
      toast.error("Failed to save incubation record");
    } else {
      toast.success("Incubation record added");
      setOpen(false);
      setForm({
        breeding_record_id: "", incubator_id: "", set_date: format(new Date(), "yyyy-MM-dd"),
        eggs_set: "", candling_date: "", fertile_count: "", infertile_count: "",
        dead_in_shell: "", hatched_count: "", hatch_date: "", transfer_batch_id: "", notes: "",
      });
      fetchData();
    }
    setLoading(false);
  };

  const stageBadge = (record: any) => {
    if (record.hatch_date) return <Badge variant="default" className="text-xs bg-success text-success-foreground">Hatched</Badge>;
    if (record.candling_date) return <Badge variant="secondary" className="text-xs">Candled</Badge>;
    return <Badge variant="outline" className="text-xs">Set</Badge>;
  };

  const daysSinceSet = (record: any) => {
    if (!record.set_date) return 0;
    return differenceInDays(new Date(), new Date(record.set_date));
  };

  const hatchRate = (record: any) => {
    const fertile = (record.fertile_count || 0);
    return fertile > 0 ? Math.round(((record.hatched_count || 0) / fertile) * 100) : 0;
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
            <Egg className="h-5 w-5 text-primary" />
            Incubation & Hatching
          </h3>
          <p className="text-sm text-muted-foreground">Log eggs set, candling, hatch rates, and chick transfers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Incubation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Incubation Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Set Date</Label>
                  <Input type="date" value={form.set_date} onChange={(e) => setForm((f) => ({ ...f, set_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Eggs Set</Label>
                  <Input type="number" min={0} value={form.eggs_set} onChange={(e) => setForm((f) => ({ ...f, eggs_set: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Incubator ID</Label>
                <Input placeholder="e.g. INC-01" value={form.incubator_id} onChange={(e) => setForm((f) => ({ ...f, incubator_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Linked Breeding Record</Label>
                <Select value={form.breeding_record_id} onValueChange={(v) => setForm((f) => ({ ...f, breeding_record_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Optional link" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {breedingRecords.map((br) => (
                      <SelectItem key={br.id} value={br.id}>{br.id.slice(0, 8)} — Set:{br.eggs_set} Fert:{br.eggs_fertile}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Candling Date</Label>
                  <Input type="date" value={form.candling_date} onChange={(e) => setForm((f) => ({ ...f, candling_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Hatch Date</Label>
                  <Input type="date" value={form.hatch_date} onChange={(e) => setForm((f) => ({ ...f, hatch_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Fertile</Label>
                  <Input type="number" min={0} value={form.fertile_count} onChange={(e) => setForm((f) => ({ ...f, fertile_count: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Infertile</Label>
                  <Input type="number" min={0} value={form.infertile_count} onChange={(e) => setForm((f) => ({ ...f, infertile_count: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Dead in Shell</Label>
                  <Input type="number" min={0} value={form.dead_in_shell} onChange={(e) => setForm((f) => ({ ...f, dead_in_shell: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Hatched Count</Label>
                  <Input type="number" min={0} value={form.hatched_count} onChange={(e) => setForm((f) => ({ ...f, hatched_count: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Transfer to Batch</Label>
                  <Select value={form.transfer_batch_id} onValueChange={(v) => setForm((f) => ({ ...f, transfer_batch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.species} — {b.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Temperature, humidity, observations..." />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Save Incubation Record"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Set</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{records.reduce((s, r) => s + (r.eggs_set || 0), 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Hatched</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{records.reduce((s, r) => s + (r.hatched_count || 0), 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Overall Hatch Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const totalSet = records.reduce((s, r) => s + (r.eggs_set || 0), 0);
                const totalHatched = records.reduce((s, r) => s + (r.hatched_count || 0), 0);
                return totalSet > 0 ? Math.round((totalHatched / totalSet) * 100) : 0;
              })()}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incubation Records</CardTitle>
          <CardDescription>{records.length} total records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set Date</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Set</TableHead>
                  <TableHead className="text-right">Fertile</TableHead>
                  <TableHead className="text-right">Infertile</TableHead>
                  <TableHead className="text-right">Dead</TableHead>
                  <TableHead className="text-right">Hatched</TableHead>
                  <TableHead>Hatch %</TableHead>
                  <TableHead>Hatch Date</TableHead>
                  <TableHead>Transfer</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">No incubation records yet</TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{format(new Date(r.set_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="text-right">{daysSinceSet(r)}</TableCell>
                      <TableCell className="text-right">{r.eggs_set}</TableCell>
                      <TableCell className="text-right">{r.fertile_count || 0}</TableCell>
                      <TableCell className="text-right">{r.infertile_count || 0}</TableCell>
                      <TableCell className="text-right">{r.dead_in_shell || 0}</TableCell>
                      <TableCell className="text-right">{r.hatched_count || 0}</TableCell>
                      <TableCell>{hatchRate(r)}%</TableCell>
                      <TableCell>{r.hatch_date ? format(new Date(r.hatch_date), "MMM dd, yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{r.transfer?.species || "—"} {r.transfer?.stage || ""}</TableCell>
                      <TableCell>{stageBadge(r)}</TableCell>
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

export default IncubationSection;
