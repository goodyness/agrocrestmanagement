import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { logActivity } from "@/lib/activityLogger";

interface SaleEntry {
  id: string;
  date: string;
  product_name: string;
  product_type: string;
  quantity: string;
  unit: string;
  price_per_unit: string;
  buyer_name: string;
  is_paid: boolean;
}

const PRODUCT_TYPES = ["Eggs", "Chicken", "Goat", "Goat Meat", "Other"];
const UNITS = ["crates", "kg", "birds", "pieces"];

const newEntry = (today: string): SaleEntry => ({
  id: crypto.randomUUID(),
  date: today,
  product_name: "Fresh Eggs",
  product_type: "Eggs",
  quantity: "",
  unit: "crates",
  price_per_unit: "",
  buyer_name: "",
  is_paid: true,
});

const BulkSalesDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const { currentBranchId } = useBranch();
  const [entries, setEntries] = useState<SaleEntry[]>([newEntry(today)]);

  const update = (id: string, field: keyof SaleEntry, value: any) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  const addRow = () => setEntries((prev) => [...prev, newEntry(today)]);
  const removeRow = (id: string) =>
    setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== id) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const valid = entries.filter(
      (e) => parseFloat(e.quantity) > 0 && parseFloat(e.price_per_unit) >= 0 && e.product_name && e.product_type
    );
    if (valid.length === 0) {
      toast.error("Add at least one valid sale row");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    let branchId = currentBranchId;
    if (!branchId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .single();
      branchId = profile?.branch_id || null;
    }

    const rows = valid.map((entry) => {
      const qty = parseFloat(entry.quantity);
      const price = parseFloat(entry.price_per_unit);
      const total = qty * price;
      return {
        date: entry.date,
        product_name: entry.product_name,
        product_type: entry.product_type,
        quantity: qty,
        unit: entry.unit,
        price_per_unit: price,
        total_amount: total,
        buyer_name: entry.buyer_name || null,
        recorded_by: user.id,
        branch_id: branchId,
        payment_status: entry.is_paid ? "paid" : "pending",
        amount_paid: entry.is_paid ? total : 0,
        delivery_status: "delivered",
      };
    });

    const { error } = await supabase.from("sales_records").insert(rows);

    if (error) {
      toast.error("Failed to add sales: " + error.message);
    } else {
      await logActivity(
        "bulk_create",
        "sales",
        undefined,
        { count: rows.length, total: rows.reduce((s, r) => s + r.total_amount, 0) },
        branchId
      );
      toast.success(`${rows.length} sales recorded`);
      setOpen(false);
      setEntries([newEntry(today)]);
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <DollarSign className="h-4 w-4 mr-2" />
          Bulk Sales Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Sales Recording</DialogTitle>
          <DialogDescription>
            Record multiple sales at once. Pick the correct date for each entry — useful for back-dated sales.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {entries.map((entry, index) => {
            const total = (parseFloat(entry.quantity) || 0) * (parseFloat(entry.price_per_unit) || 0);
            return (
              <div key={entry.id} className="p-3 border rounded-lg space-y-3 bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">Sale {index + 1}</span>
                  {entries.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(entry.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={entry.date}
                      max={today}
                      onChange={(e) => update(entry.id, "date", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Product Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={entry.product_type}
                      onChange={(e) => update(entry.id, "product_type", e.target.value)}
                    >
                      {PRODUCT_TYPES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Product Name</Label>
                    <Input
                      value={entry.product_name}
                      onChange={(e) => update(entry.id, "product_name", e.target.value)}
                      placeholder="e.g. Fresh Eggs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.quantity}
                      onChange={(e) => update(entry.id, "quantity", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={entry.unit}
                      onChange={(e) => update(entry.id, "unit", e.target.value)}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price / Unit (₦)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.price_per_unit}
                      onChange={(e) => update(entry.id, "price_per_unit", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-2">
                    <Label className="text-xs">Buyer Name (optional)</Label>
                    <Input
                      value={entry.buyer_name}
                      onChange={(e) => update(entry.id, "buyer_name", e.target.value)}
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2 h-10">
                      <Checkbox
                        id={`paid-${entry.id}`}
                        checked={entry.is_paid}
                        onCheckedChange={(c) => update(entry.id, "is_paid", c === true)}
                      />
                      <Label htmlFor={`paid-${entry.id}`} className="text-xs cursor-pointer">
                        Paid
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-right text-muted-foreground">
                  Total: <span className="font-semibold text-primary">₦{total.toLocaleString()}</span>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" className="w-full" onClick={addRow}>
            <Plus className="h-4 w-4 mr-2" /> Add Another Sale
          </Button>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Recording..."
              : `Record ${entries.filter((e) => parseFloat(e.quantity) > 0).length} Sale(s)`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkSalesDialog;
