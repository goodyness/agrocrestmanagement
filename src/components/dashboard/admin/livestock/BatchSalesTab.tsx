import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Props { batchId: string; onChange?: () => void }

export default function BatchSalesTab({ batchId, onChange }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ sale_date: new Date().toISOString().slice(0, 10), quantity: "", unit_price: "", buyer: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("batch_sales").select("*, profiles:recorded_by(name)").eq("batch_id", batchId).order("sale_date", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { if (batchId) load(); }, [batchId]);

  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  const submit = async () => {
    const qty = parseFloat(f.quantity) || 0;
    const price = parseFloat(f.unit_price) || 0;
    if (qty <= 0 || price <= 0) return toast.error("Enter quantity and unit price");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_sales").insert([{
      batch_id: batchId,
      sale_date: f.sale_date,
      quantity: qty,
      unit_price: price,
      total_amount: qty * price,
      buyer: f.buyer.slice(0, 200) || null,
      notes: f.notes.slice(0, 500) || null,
      recorded_by: user?.id || null,
    }] as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Sale recorded");
    setF({ sale_date: new Date().toISOString().slice(0, 10), quantity: "", unit_price: "", buyer: "", notes: "" });
    setOpen(false);
    load();
    onChange?.();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Sales — Total ₦{total.toLocaleString()}</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Record Sale</Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No sales recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit ₦</TableHead>
                  <TableHead>Total ₦</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.sale_date}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell>{Number(r.unit_price).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{Number(r.total_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{r.buyer || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.profiles?.name || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Sale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.sale_date} onChange={(e) => setF({ ...f, sale_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Unit Price (₦)</Label><Input type="number" min={0} value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></div>
              <div className="space-y-1"><Label>Buyer</Label><Input value={f.buyer} onChange={(e) => setF({ ...f, buyer: e.target.value })} maxLength={200} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></div>
            <div className="text-sm text-muted-foreground">Total: <b>₦{((parseFloat(f.quantity) || 0) * (parseFloat(f.unit_price) || 0)).toLocaleString()}</b></div>
            <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Sale"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
