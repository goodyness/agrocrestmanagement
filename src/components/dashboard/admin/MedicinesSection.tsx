import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import { Plus, AlertTriangle, Pill, Minus } from "lucide-react";
import { differenceInDays, format } from "date-fns";

interface Medicine {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  reorder_point: number;
  expiry_date: string | null;
  notes: string | null;
  branch_id: string | null;
}

const PAGE_SIZE = 15;

const MedicinesSection = () => {
  const { currentBranchId } = useBranch();
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<{ med: Medicine; type: "purchase" | "usage" } | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "medicine",
    unit: "pcs",
    current_stock: "0",
    reorder_point: "0",
    expiry_date: "",
    notes: "",
  });
  const [moveForm, setMoveForm] = useState({ quantity: "", unit_cost: "", notes: "" });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("medicines").select("*").order("name");
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setItems((data as Medicine[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentBranchId]);

  const addItem = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("medicines").insert({
      name: form.name,
      category: form.category,
      unit: form.unit,
      current_stock: Number(form.current_stock) || 0,
      reorder_point: Number(form.reorder_point) || 0,
      expiry_date: form.expiry_date || null,
      notes: form.notes || null,
      branch_id: currentBranchId,
    });
    if (error) return toast.error(error.message);
    toast.success("Added");
    setOpen(false);
    setForm({ name: "", category: "medicine", unit: "pcs", current_stock: "0", reorder_point: "0", expiry_date: "", notes: "" });
    load();
  };

  const recordMovement = async () => {
    if (!moveOpen) return;
    const qty = Number(moveForm.quantity);
    if (!qty || qty <= 0) return toast.error("Quantity must be > 0");
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Not signed in");
    const unitCost = Number(moveForm.unit_cost) || 0;
    const { error } = await supabase.from("medicine_movements").insert({
      medicine_id: moveOpen.med.id,
      movement_type: moveOpen.type,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: unitCost * qty,
      notes: moveForm.notes || null,
      branch_id: currentBranchId,
      recorded_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success(moveOpen.type === "purchase" ? "Stock added" : "Usage logged");
    setMoveOpen(null);
    setMoveForm({ quantity: "", unit_cost: "", notes: "" });
    load();
  };

  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  const expiryStatus = (d: string | null) => {
    if (!d) return null;
    const days = differenceInDays(new Date(d), new Date());
    if (days < 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 60) return <Badge className="bg-amber-500">Expires in {days}d</Badge>;
    return <span className="text-xs text-muted-foreground">{format(new Date(d), "MMM d, yyyy")}</span>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" /> Medicines & Vaccines</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add medicine / vaccine</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicine">Medicine</SelectItem>
                      <SelectItem value="vaccine">Vaccine</SelectItem>
                      <SelectItem value="supplement">Supplement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ml, pcs, vial" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Initial stock</Label><Input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} /></div>
                <div><Label>Reorder point</Label><Input type="number" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} /></div>
              </div>
              <div><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={addItem}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((m) => {
                    const low = m.current_stock <= m.reorder_point;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{m.category}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{m.current_stock} {m.unit}</span>
                            {low && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Low</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{expiryStatus(m.expiry_date)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => { setMoveOpen({ med: m, type: "purchase" }); }}><Plus className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => { setMoveOpen({ med: m, type: "usage" }); }}><Minus className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-3">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!moveOpen} onOpenChange={(o) => !o && setMoveOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{moveOpen?.type === "purchase" ? "Add stock" : "Log usage"} — {moveOpen?.med.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quantity ({moveOpen?.med.unit})</Label><Input type="number" value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} /></div>
            {moveOpen?.type === "purchase" && (
              <div><Label>Unit cost</Label><Input type="number" value={moveForm.unit_cost} onChange={(e) => setMoveForm({ ...moveForm, unit_cost: e.target.value })} /></div>
            )}
            <div><Label>Notes</Label><Textarea value={moveForm.notes} onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={recordMovement}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MedicinesSection;
