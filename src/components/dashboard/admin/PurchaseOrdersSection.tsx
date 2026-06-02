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
import { Plus, Trash2, ClipboardList, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface POItem {
  id?: string;
  item_type: "feed" | "medicine" | "supply";
  item_ref_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  received_quantity?: number;
}

interface PO {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  total_amount: number;
  order_date: string;
  expected_delivery: string | null;
  received_date: string | null;
  notes: string | null;
}

const PAGE_SIZE = 15;
const statusVariant: Record<string, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-blue-500 text-white",
  partial: "bg-amber-500 text-white",
  received: "bg-green-600 text-white",
  cancelled: "bg-destructive text-destructive-foreground",
};

const PurchaseOrdersSection = () => {
  const { currentBranchId } = useBranch();
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<PO | null>(null);
  const [viewItems, setViewItems] = useState<POItem[]>([]);

  const [form, setForm] = useState({ supplier_name: "", supplier_phone: "", expected_delivery: "", notes: "" });
  const [lines, setLines] = useState<POItem[]>([
    { item_type: "feed", item_ref_id: null, item_name: "", quantity: 0, unit: "kg", unit_price: 0, line_total: 0 },
  ]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("purchase_orders").select("*").order("order_date", { ascending: false });
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setPos((data as PO[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentBranchId]);

  const updateLine = (i: number, patch: Partial<POItem>) => {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l, ...patch };
      next.line_total = (Number(next.quantity) || 0) * (Number(next.unit_price) || 0);
      return next;
    }));
  };

  const addLine = () => setLines([...lines, { item_type: "feed", item_ref_id: null, item_name: "", quantity: 0, unit: "kg", unit_price: 0, line_total: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const totalAmount = lines.reduce((s, l) => s + (l.line_total || 0), 0);

  const savePO = async () => {
    if (!form.supplier_name.trim()) return toast.error("Supplier required");
    const valid = lines.filter(l => l.item_name.trim() && l.quantity > 0);
    if (valid.length === 0) return toast.error("Add at least one line item");
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Not signed in");

    const { data: po, error } = await supabase.from("purchase_orders").insert({
      supplier_name: form.supplier_name,
      supplier_phone: form.supplier_phone || null,
      status: "draft",
      total_amount: totalAmount,
      expected_delivery: form.expected_delivery || null,
      notes: form.notes || null,
      branch_id: currentBranchId,
      created_by: user.id,
    }).select().single();
    if (error) return toast.error(error.message);

    const itemRows = valid.map(l => ({
      po_id: po.id,
      item_type: l.item_type,
      item_ref_id: l.item_ref_id,
      item_name: l.item_name,
      quantity: l.quantity,
      unit: l.unit,
      unit_price: l.unit_price,
      line_total: l.line_total,
    }));
    const { error: itemsErr } = await supabase.from("purchase_order_items").insert(itemRows);
    if (itemsErr) return toast.error(itemsErr.message);

    toast.success("Purchase order created");
    setOpen(false);
    setForm({ supplier_name: "", supplier_phone: "", expected_delivery: "", notes: "" });
    setLines([{ item_type: "feed", item_ref_id: null, item_name: "", quantity: 0, unit: "kg", unit_price: 0, line_total: 0 }]);
    load();
  };

  const openView = async (po: PO) => {
    setViewing(po);
    const { data } = await supabase.from("purchase_order_items").select("*").eq("po_id", po.id);
    setViewItems((data as POItem[]) || []);
  };

  const markReceived = async () => {
    if (!viewing) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // For each line, create the appropriate inventory movement
    for (const item of viewItems) {
      const remaining = item.quantity - (item.received_quantity || 0);
      if (remaining <= 0) continue;

      if (item.item_type === "medicine" && item.item_ref_id) {
        await supabase.from("medicine_movements").insert({
          medicine_id: item.item_ref_id,
          movement_type: "purchase",
          quantity: remaining,
          unit_cost: item.unit_price,
          total_cost: remaining * item.unit_price,
          notes: `PO ${viewing.po_number}`,
          branch_id: currentBranchId,
          recorded_by: user.id,
        });
      } else if (item.item_type === "supply" && item.item_ref_id) {
        await supabase.from("supply_movements").insert({
          supply_id: item.item_ref_id,
          movement_type: "purchase",
          quantity: remaining,
          unit_cost: item.unit_price,
          total_cost: remaining * item.unit_price,
          notes: `PO ${viewing.po_number}`,
          branch_id: currentBranchId,
          recorded_by: user.id,
        });
      } else if (item.item_type === "feed" && item.item_ref_id) {
        await supabase.from("feed_purchases").insert({
          feed_type_id: item.item_ref_id,
          quantity: remaining,
          unit: item.unit,
          price_per_unit: item.unit_price,
          total_cost: remaining * item.unit_price,
          purchased_by: user.id,
          notes: `PO ${viewing.po_number}`,
          branch_id: currentBranchId,
        });
      }

      if (item.id) {
        await supabase.from("purchase_order_items").update({ received_quantity: item.quantity }).eq("id", item.id);
      }
    }

    await supabase.from("purchase_orders").update({
      status: "received",
      received_date: new Date().toISOString().slice(0, 10),
    }).eq("id", viewing.id);

    toast.success("Marked as received — inventory updated");
    setViewing(null);
    setViewItems([]);
    load();
  };

  const setStatus = async (po: PO, status: string) => {
    const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", po.id);
    if (error) toast.error(error.message); else { toast.success("Status updated"); load(); }
  };

  const pageItems = pos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(pos.length / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Purchase Orders</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New PO</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Supplier</Label><Input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.supplier_phone} onChange={(e) => setForm({ ...form, supplier_phone: e.target.value })} /></div>
              </div>
              <div><Label>Expected delivery</Label><Input type="date" value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} /></div>
              <div className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line items</Label>
                  <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Add line</Button>
                </div>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <Select value={l.item_type} onValueChange={(v) => updateLine(i, { item_type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="feed">Feed</SelectItem>
                          <SelectItem value="medicine">Medicine</SelectItem>
                          <SelectItem value="supply">Supply</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input placeholder="Item name" value={l.item_name} onChange={(e) => updateLine(i, { item_name: e.target.value })} /></div>
                    <div className="col-span-2"><Input placeholder="Qty" type="number" value={l.quantity || ""} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} /></div>
                    <div className="col-span-1"><Input placeholder="Unit" value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} /></div>
                    <div className="col-span-2"><Input placeholder="Price" type="number" value={l.unit_price || ""} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} /></div>
                    <div className="col-span-1 text-right text-sm">{l.line_total.toFixed(0)}</div>
                    <div className="col-span-1"><Button size="sm" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3" /></Button></div>
                  </div>
                ))}
                <div className="text-right font-medium">Total: ₦{totalAmount.toLocaleString()}</div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={savePO}>Create PO</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : pos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pageItems.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                      <TableCell>{po.supplier_name}</TableCell>
                      <TableCell>{format(new Date(po.order_date), "MMM d")}</TableCell>
                      <TableCell>₦{Number(po.total_amount).toLocaleString()}</TableCell>
                      <TableCell><Badge className={statusVariant[po.status] || ""}>{po.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => openView(po)}>View</Button>
                        {po.status === "draft" && <Button size="sm" variant="outline" onClick={() => setStatus(po, "sent")}>Send</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
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

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) { setViewing(null); setViewItems([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{viewing?.po_number} — {viewing?.supplier_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {viewItems.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant="outline">{it.item_type}</Badge></TableCell>
                    <TableCell>{it.item_name}</TableCell>
                    <TableCell>{it.quantity} {it.unit}</TableCell>
                    <TableCell>₦{Number(it.unit_price).toLocaleString()}</TableCell>
                    <TableCell>₦{Number(it.line_total).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right font-semibold">Total: ₦{Number(viewing?.total_amount || 0).toLocaleString()}</div>
            {viewing?.notes && <p className="text-sm text-muted-foreground">Notes: {viewing.notes}</p>}
          </div>
          <DialogFooter>
            {viewing && viewing.status !== "received" && viewing.status !== "cancelled" && (
              <>
                <Button variant="outline" onClick={() => viewing && setStatus(viewing, "cancelled")}>Cancel PO</Button>
                <Button onClick={markReceived}><CheckCircle2 className="h-4 w-4 mr-1" />Mark Received</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PurchaseOrdersSection;
