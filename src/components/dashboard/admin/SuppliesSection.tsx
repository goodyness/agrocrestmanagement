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
import { Plus, AlertTriangle, Package, Minus } from "lucide-react";

interface Supply {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  reorder_point: number;
  notes: string | null;
  branch_id: string | null;
}

const PAGE_SIZE = 15;

const SuppliesSection = () => {
  const { currentBranchId } = useBranch();
  const [items, setItems] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<{ item: Supply; type: "purchase" | "usage" } | null>(null);

  const [form, setForm] = useState({ name: "", category: "general", unit: "pcs", current_stock: "0", reorder_point: "0", notes: "" });
  const [moveForm, setMoveForm] = useState({ quantity: "", unit_cost: "", notes: "" });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("supplies").select("*").order("name");
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setItems((data as Supply[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentBranchId]);

  const addItem = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("supplies").insert({
      name: form.name,
      category: form.category,
      unit: form.unit,
      current_stock: Number(form.current_stock) || 0,
      reorder_point: Number(form.reorder_point) || 0,
      notes: form.notes || null,
      branch_id: currentBranchId,
    });
    if (error) return toast.error(error.message);
    toast.success("Added");
    setOpen(false);
    setForm({ name: "", category: "general", unit: "pcs", current_stock: "0", reorder_point: "0", notes: "" });
    load();
  };

  const recordMovement = async () => {
    if (!moveOpen) return;
    const qty = Number(moveForm.quantity);
    if (!qty || qty <= 0) return toast.error("Quantity must be > 0");
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Not signed in");
    const unitCost = Number(moveForm.unit_cost) || 0;
    const { error } = await supabase.from("supply_movements").insert({
      supply_id: moveOpen.item.id,
      movement_type: moveOpen.type,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: unitCost * qty,
      notes: moveForm.notes || null,
      branch_id: currentBranchId,
      recorded_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setMoveOpen(null);
    setMoveForm({ quantity: "", unit_cost: "", notes: "" });
    load();
  };

  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> General Supplies</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add supply</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add supply</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="tools">Tools</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Stock</Label><Input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} /></div>
                <div><Label>Reorder point</Label><Input type="number" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={addItem}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No supplies yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Stock</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pageItems.map((s) => {
                    const low = s.current_stock <= s.reorder_point;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{s.category}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{s.current_stock} {s.unit}</span>
                            {low && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Reorder</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setMoveOpen({ item: s, type: "purchase" })}><Plus className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => setMoveOpen({ item: s, type: "usage" })}><Minus className="h-3 w-3" /></Button>
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
          <DialogHeader><DialogTitle>{moveOpen?.type === "purchase" ? "Add stock" : "Log usage"} — {moveOpen?.item.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quantity ({moveOpen?.item.unit})</Label><Input type="number" value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} /></div>
            {moveOpen?.type === "purchase" && <div><Label>Unit cost</Label><Input type="number" value={moveForm.unit_cost} onChange={(e) => setMoveForm({ ...moveForm, unit_cost: e.target.value })} /></div>}
            <div><Label>Notes</Label><Textarea value={moveForm.notes} onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={recordMovement}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SuppliesSection;
