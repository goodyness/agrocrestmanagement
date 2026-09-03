import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, TrendingUp } from "lucide-react";

interface Props { batch: any; onChange?: () => void }

type ProductOption = { value: string; label: string; units: string[]; name: string; isAnimal: boolean };

const GENERIC_OPTIONS: ProductOption[] = [
  { value: "live_animal", label: "Live Animal", units: ["animal", "kg"], name: "Live Animal", isAnimal: true },
  { value: "deceased_animal", label: "Deceased Animal", units: ["animal", "kg"], name: "Deceased Animal", isAnimal: true },
  { value: "manure", label: "Manure", units: ["bag"], name: "Manure", isAnimal: false },
  { value: "other", label: "Other", units: ["piece", "kg", "bag"], name: "Other product", isAnimal: false },
];

// Smart product/unit matrix per livestock category
const getProductOptions = (species?: string, speciesType?: string): ProductOption[] => {
  const s = (species || "").toLowerCase();
  const t = (speciesType || "").toLowerCase();

  if (s === "chicken" && t === "layer") {
    return [
      { value: "live_bird", label: "Live Bird", units: ["bird", "kg"], name: "Live Bird (Layer)", isAnimal: true },
      { value: "deceased_bird", label: "Deceased Bird", units: ["bird", "kg"], name: "Deceased Bird (Layer)", isAnimal: true },
      { value: "egg", label: "Eggs", units: ["crate"], name: "Eggs", isAnimal: false },
    ];
  }

  if (s === "chicken" && (t === "broiler" || t === "noiler")) {
    const label = t.charAt(0).toUpperCase() + t.slice(1);
    return [
      { value: "live_bird", label: "Live Bird", units: ["bird", "kg"], name: `Live Bird (${label})`, isAnimal: true },
      { value: "deceased_bird", label: "Deceased Bird", units: ["bird", "kg"], name: `Deceased Bird (${label})`, isAnimal: true },
      { value: "frozen_bird", label: "Frozen Bird", units: ["bird", "kg"], name: `Frozen Bird (${label})`, isAnimal: true },
    ];
  }

  if (s === "chicken") {
    return [
      { value: "live_bird", label: "Live Bird", units: ["bird", "kg"], name: "Live Bird", isAnimal: true },
      { value: "deceased_bird", label: "Deceased Bird", units: ["bird", "kg"], name: "Deceased Bird", isAnimal: true },
      { value: "frozen_bird", label: "Frozen Bird", units: ["bird", "kg"], name: "Frozen Bird", isAnimal: true },
      { value: "egg", label: "Eggs", units: ["crate"], name: "Eggs", isAnimal: false },
    ];
  }

  return GENERIC_OPTIONS;
};


export default function BatchSalesTab({ batch, onChange }: Props) {
  const batchId = batch?.id;
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [costs, setCosts] = useState({ expenses: 0, purchase: 0 });

  const productOptions = getProductOptions(batch?.species, batch?.species_type);
  const firstOption = productOptions[0];

  const defaultForm = {
    sale_date: new Date().toISOString().slice(0, 10),
    product_type: firstOption.value,
    quantity: "",
    unit: firstOption.units[0],
    unit_price: "",
    customer_id: "",
    buyer: "",
    payment_status: "paid",
    amount_paid: "",
    notes: "",
    deduct: true,
    animals_sold: "",
  };
  const [f, setF] = useState<any>(defaultForm);

  const selected = productOptions.find((p) => p.value === f.product_type) || firstOption;
  const productName = selected.name;

  const changeProduct = (v: string) => {
    const opt = productOptions.find((p) => p.value === v) || firstOption;
    setF((prev: any) => ({ ...prev, product_type: v, unit: opt.units[0], animals_sold: "" }));
  };

  const load = async () => {
    const { data } = await supabase
      .from("batch_sales")
      .select("*, profiles:recorded_by(name), customers:customer_id(name)")
      .eq("batch_id", batchId)
      .order("sale_date", { ascending: false });
    setRows(data || []);

    const { data: exp } = await supabase.from("miscellaneous_expenses").select("amount").eq("batch_id", batchId);
    setCosts({
      expenses: (exp || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
      purchase: Number(batch?.total_cost || 0),
    });
  };

  const loadCustomers = async () => {
    let q = supabase.from("customers").select("id, name").eq("is_active", true).order("name");
    if (batch?.branch_id) q = q.eq("branch_id", batch.branch_id);
    const { data } = await q;
    setCustomers(data || []);
  };

  useEffect(() => { if (batchId) { load(); loadCustomers(); } }, [batchId]);

  const totalSales = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalCost = costs.expenses + costs.purchase;
  const netProfit = totalSales - totalCost;
  const recovery = totalCost > 0 ? Math.min(100, (totalSales / totalCost) * 100) : 0;

  const qty = parseFloat(f.quantity) || 0;
  const price = parseFloat(f.unit_price) || 0;
  const lineTotal = qty * price;

  const submit = async () => {
    if (qty <= 0 || price <= 0) return toast.error("Enter quantity and unit price");
    if (!f.product_name.trim()) return toast.error("Enter what was sold");
    const paid = f.payment_status === "paid" ? lineTotal : parseFloat(f.amount_paid) || 0;
    if (paid > lineTotal) return toast.error("Amount paid cannot exceed total");
    const deductable = f.deduct && ["live_bird", "dressed_bird", "livestock"].includes(f.product_type) && f.unit === "bird";
    if (deductable && qty > Number(batch.current_quantity || 0)) {
      return toast.error(`Only ${batch.current_quantity} animals left in this batch`);
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const buyerName = f.customer_id ? customers.find((c) => c.id === f.customer_id)?.name : f.buyer.slice(0, 200);

    const { data: sale, error: saleErr } = await supabase
      .from("sales_records")
      .insert({
        product_name: f.product_name.slice(0, 200),
        product_type: f.product_type,
        quantity: qty,
        unit: f.unit,
        price_per_unit: price,
        total_amount: lineTotal,
        buyer_name: buyerName || null,
        customer_id: f.customer_id || null,
        date: f.sale_date,
        recorded_by: user?.id || null,
        branch_id: batch.branch_id || null,
        payment_status: f.payment_status,
        amount_paid: paid,
        delivery_status: "delivered",
        batch_id: batchId,
      } as any)
      .select()
      .single();

    if (saleErr) { setSaving(false); return toast.error(saleErr.message); }

    const { error } = await supabase.from("batch_sales").insert([{
      batch_id: batchId,
      sales_record_id: sale?.id || null,
      customer_id: f.customer_id || null,
      product_name: f.product_name.slice(0, 200),
      unit: f.unit,
      sale_date: f.sale_date,
      quantity: qty,
      unit_price: price,
      total_amount: lineTotal,
      payment_status: f.payment_status,
      amount_paid: paid,
      buyer: buyerName || null,
      notes: f.notes.slice(0, 500) || null,
      recorded_by: user?.id || null,
    }] as any);

    if (error) { setSaving(false); return toast.error(error.message); }

    if (deductable) {
      await supabase
        .from("livestock_batches")
        .update({ current_quantity: Math.max(0, Number(batch.current_quantity || 0) - qty) })
        .eq("id", batchId);
    }

    setSaving(false);
    toast.success("Sale recorded and added to farm sales records");
    setF(defaultForm);
    setOpen(false);
    load();
    onChange?.();
  };

  return (
    <div className="space-y-3">
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Sales vs Cost Recovery</p>
            <Badge variant={netProfit > 0 ? "default" : "secondary"}>
              {netProfit > 0 ? "In Profit" : "Recovering costs"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            <Box label="Total Sales" value={totalSales} />
            <Box label="Purchase Cost" value={costs.purchase} />
            <Box label="Expenses" value={costs.expenses} />
            <Box label={netProfit >= 0 ? "Net Profit" : "Still to recover"} value={Math.abs(netProfit)} tone={netProfit >= 0 ? "ok" : "warn"} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {recovery.toFixed(0)}% of total spend recovered. Profit only starts counting after ₦{totalCost.toLocaleString()} is covered.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Sales — Total ₦{totalSales.toLocaleString()}</CardTitle>
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
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit ₦</TableHead>
                    <TableHead>Total ₦</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.sale_date}</TableCell>
                      <TableCell className="text-xs">{r.product_name || "—"}</TableCell>
                      <TableCell>{r.quantity} {r.unit || ""}</TableCell>
                      <TableCell>{Number(r.unit_price).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{Number(r.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{r.customers?.name || r.buyer || "—"}</TableCell>
                      <TableCell className="text-xs capitalize">
                        <Badge variant={r.payment_status === "paid" ? "default" : "secondary"} className="text-[10px]">
                          {(r.payment_status || "paid").replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.profiles?.name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Batch Sale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.sale_date} onChange={(e) => setF({ ...f, sale_date: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Product type</Label>
                <Select value={f.product_type} onValueChange={(v) => setF({ ...f, product_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>What was sold</Label>
              <Input value={f.product_name} onChange={(e) => setF({ ...f, product_name: e.target.value })} maxLength={200} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Price / unit (₦)</Label><Input type="number" min={0} value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Customer</Label>
                <Select value={f.customer_id || "none"} onValueChange={(v) => setF({ ...f, customer_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Walk-in / not listed</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Buyer name</Label>
                <Input value={f.buyer} onChange={(e) => setF({ ...f, buyer: e.target.value })} maxLength={200} disabled={!!f.customer_id} placeholder={f.customer_id ? "Using selected customer" : "Buyer name"} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment status</Label>
                <Select value={f.payment_status} onValueChange={(v) => setF({ ...f, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {f.payment_status === "partial" && (
                <div className="space-y-1"><Label>Amount paid (₦)</Label><Input type="number" min={0} value={f.amount_paid} onChange={(e) => setF({ ...f, amount_paid: e.target.value })} /></div>
              )}
            </div>

            <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={f.deduct} onCheckedChange={(v) => setF({ ...f, deduct: !!v })} />
              Deduct sold animals from batch count ({batch?.current_quantity} left)
            </label>

            <div className="text-sm text-muted-foreground">Total: <b>₦{lineTotal.toLocaleString()}</b></div>
            <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Sale"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border p-2">
      <p className={`text-sm font-bold ${tone === "ok" ? "text-primary" : tone === "warn" ? "text-destructive" : ""}`}>₦{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
