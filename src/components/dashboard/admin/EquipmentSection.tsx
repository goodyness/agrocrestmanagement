import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wrench, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import { differenceInDays, parseISO, format } from "date-fns";

type Equipment = {
  id: string; name: string; type: string | null; serial_number: string | null;
  purchase_date: string | null; purchase_cost: number | null; warranty_end: string | null;
  location: string | null; status: string; notes: string | null; branch_id: string | null;
};
type MaintenanceLog = {
  id: string; equipment_id: string; service_date: string; service_type: string;
  description: string | null; cost: number | null; performed_by: string | null;
  next_due_date: string | null;
};

const EquipmentSection = () => {
  const { currentBranchId } = useBranch();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [activeEquip, setActiveEquip] = useState<Equipment | null>(null);

  const [form, setForm] = useState({ name: "", type: "", serial_number: "", purchase_date: "", purchase_cost: "", warranty_end: "", location: "", notes: "" });
  const [mform, setMform] = useState({ service_date: format(new Date(), "yyyy-MM-dd"), service_type: "", description: "", cost: "", performed_by: "", next_due_date: "" });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("equipment").select("*").order("created_at", { ascending: false });
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setEquipment((data || []) as Equipment[]);
    const { data: l } = await supabase.from("maintenance_logs").select("*").order("service_date", { ascending: false });
    setLogs((l || []) as MaintenanceLog[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [currentBranchId]);

  const pag = usePagination({ totalItems: equipment.length, itemsPerPage: 15 });
  const paginatedEquipment = equipment.slice(pag.paginatedRange.startIndex, pag.paginatedRange.endIndex);

  const handleAdd = async () => {
    if (!form.name) return toast.error("Name required");
    const { error } = await supabase.from("equipment").insert({
      name: form.name, type: form.type || null, serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null, purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : 0,
      warranty_end: form.warranty_end || null, location: form.location || null, notes: form.notes || null,
      branch_id: currentBranchId,
    });
    if (error) return toast.error(error.message);
    toast.success("Equipment added");
    setAddOpen(false);
    setForm({ name: "", type: "", serial_number: "", purchase_date: "", purchase_cost: "", warranty_end: "", location: "", notes: "" });
    load();
  };

  const handleMaint = async () => {
    if (!activeEquip || !mform.service_type) return toast.error("Service type required");
    const { error } = await supabase.from("maintenance_logs").insert({
      equipment_id: activeEquip.id, service_date: mform.service_date, service_type: mform.service_type,
      description: mform.description || null, cost: mform.cost ? Number(mform.cost) : 0,
      performed_by: mform.performed_by || null, next_due_date: mform.next_due_date || null,
      branch_id: activeEquip.branch_id,
    });
    if (error) return toast.error(error.message);
    toast.success("Maintenance logged");
    setMaintOpen(false);
    setMform({ service_date: format(new Date(), "yyyy-MM-dd"), service_type: "", description: "", cost: "", performed_by: "", next_due_date: "" });
    load();
  };

  const getAlert = (e: Equipment) => {
    const myLogs = logs.filter(l => l.equipment_id === e.id);
    const nextDues = myLogs.map(l => l.next_due_date).filter(Boolean) as string[];
    const soonest = nextDues.sort()[0];
    if (soonest) {
      const d = differenceInDays(parseISO(soonest), new Date());
      if (d <= 7) return { kind: "maint", days: d, date: soonest };
    }
    if (e.warranty_end) {
      const d = differenceInDays(parseISO(e.warranty_end), new Date());
      if (d <= 30 && d >= 0) return { kind: "warranty", days: d, date: e.warranty_end };
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Equipment & Maintenance</CardTitle>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Equipment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Equipment</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label><Input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="generator, feeder..." /></div>
                <div><Label>Serial #</Label><Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></div>
                <div><Label>Cost (₦)</Label><Input type="number" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Warranty End</Label><Input type="date" value={form.warranty_end} onChange={e => setForm({ ...form, warranty_end: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleAdd}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : equipment.length === 0 ? <p className="text-muted-foreground text-sm">No equipment registered yet.</p> : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Warranty</TableHead><TableHead>Alerts</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {paginatedEquipment.map(e => {
                  const alert = getAlert(e);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell>{e.type || "—"}</TableCell>
                      <TableCell>{e.warranty_end ? format(parseISO(e.warranty_end), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>
                        {alert ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />
                            {alert.kind === "maint" ? `Service in ${alert.days}d` : `Warranty in ${alert.days}d`}
                          </Badge>
                        ) : <Badge variant="secondary">OK</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => { setActiveEquip(e); setMaintOpen(true); }}>Log Service</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationControls currentPage={pag.currentPage} totalPages={pag.totalPages} onPageChange={pag.goToPage} getPageNumbers={pag.getPageNumbers} />
          </>
        )}

        <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Maintenance — {activeEquip?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={mform.service_date} onChange={e => setMform({ ...mform, service_date: e.target.value })} /></div>
                <div><Label>Service Type *</Label><Input value={mform.service_type} onChange={e => setMform({ ...mform, service_type: e.target.value })} placeholder="oil change, repair..." /></div>
              </div>
              <div><Label>Description</Label><Textarea value={mform.description} onChange={e => setMform({ ...mform, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cost (₦)</Label><Input type="number" value={mform.cost} onChange={e => setMform({ ...mform, cost: e.target.value })} /></div>
                <div><Label>Performed By</Label><Input value={mform.performed_by} onChange={e => setMform({ ...mform, performed_by: e.target.value })} /></div>
              </div>
              <div><Label>Next Due Date</Label><Input type="date" value={mform.next_due_date} onChange={e => setMform({ ...mform, next_due_date: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleMaint}>Save Log</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default EquipmentSection;
