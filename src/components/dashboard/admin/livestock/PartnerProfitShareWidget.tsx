import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Handshake, Plus, CheckCircle2, Clock, XCircle, Wallet, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  partnerLink: any; // partner_batches row with partners+profile
  totalRevenue: number; // eggs/sales revenue
  totalCost: number;    // purchase + expenses
}

const STATUS_META: Record<string, { icon: any; color: string; label: string }> = {
  pending:   { icon: Clock,        color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", label: "Pending" },
  paid:      { icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", label: "Paid" },
  cancelled: { icon: XCircle,      color: "bg-muted text-muted-foreground border-border", label: "Cancelled" },
};

const PartnerProfitShareWidget = ({ partnerLink, totalRevenue, totalCost }: Props) => {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"pending" | "paid" | "cancelled">("pending");
  const [scheduled, setScheduled] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const totalProfit = totalRevenue - totalCost;
  const ownershipPct = Number(partnerLink?.share_percentage || 0);
  const profitPct = Number(partnerLink?.profit_share_percentage ?? partnerLink?.share_percentage ?? 0);
  const partnerShareAmount = totalProfit > 0 ? (totalProfit * profitPct) / 100 : 0;
  const paidToDate = payouts.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingTotal = payouts.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = Math.max(0, partnerShareAmount - paidToDate);

  const load = async () => {
    if (!partnerLink?.id) return;
    const { data } = await supabase
      .from("partner_payouts")
      .select("*")
      .eq("partner_batch_id", partnerLink.id)
      .order("created_at", { ascending: false });
    setPayouts(data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [partnerLink?.id]);

  const suggest = () => setAmount(outstanding > 0 ? outstanding.toFixed(0) : "0");

  const save = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      partner_batch_id: partnerLink.id,
      amount: Number(amount),
      status,
      scheduled_date: scheduled || null,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      notes: notes || null,
      created_by: user?.id || null,
    };
    const { error } = await supabase.from("partner_payouts").insert(payload);
    if (error) toast.error("Failed to record payout: " + error.message);
    else {
      toast.success("Payout recorded");
      setOpen(false); setAmount(""); setNotes(""); setStatus("pending");
      load();
    }
    setSaving(false);
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("partner_payouts")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marked as paid"); load(); }
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("partner_payouts")
      .update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Payout cancelled"); load(); }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" /> Profit Share Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-md border p-2">
            <p className="text-[11px] text-muted-foreground">Ownership</p>
            <p className="font-bold">{ownershipPct}%</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-[11px] text-muted-foreground">Profit Share</p>
            <p className="font-bold">{profitPct}%</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-[11px] text-muted-foreground">Total Profit</p>
            <p className={`font-bold ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
              ₦{totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-md border p-2 bg-primary/5">
            <p className="text-[11px] text-muted-foreground">Partner's Share</p>
            <p className="font-bold text-primary">
              ₦{partnerShareAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold">Paid</p>
            <p className="font-bold">₦{paidToDate.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
            <p className="text-amber-700 dark:text-amber-400 font-semibold">Pending</p>
            <p className="font-bold">₦{pendingTotal.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-primary/10 border border-primary/30">
            <p className="text-primary font-semibold">Outstanding</p>
            <p className="font-bold">₦{outstanding.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Settlement Records</p>
          <Button size="sm" onClick={() => { suggest(); setOpen(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Add Payout
          </Button>
        </div>

        {payouts.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-3 border rounded">
            No payouts recorded yet.
          </div>
        ) : (
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p: any) => {
                  const meta = STATUS_META[p.status] || STATUS_META.pending;
                  const Icon = meta.icon;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : (p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : "-")}
                      </TableCell>
                      <TableCell className="text-right font-semibold">₦{Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
                          <Icon className="h-3 w-3 mr-1" /> {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{p.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        {p.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => markPaid(p.id)} className="h-7 px-2 text-xs">Mark Paid</Button>
                            <Button size="sm" variant="ghost" onClick={() => cancel(p.id)} className="h-7 px-2 text-xs text-destructive">Cancel</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Record Partner Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Total profit</span><span className="font-semibold">₦{totalProfit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Partner share ({profitPct}%)</span><span className="font-semibold text-primary">₦{partnerShareAmount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Outstanding</span><span className="font-semibold">₦{outstanding.toLocaleString()}</span></div>
            </div>
            <div>
              <Label>Amount (₦)</Label>
              <div className="flex gap-2">
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
                <Button type="button" variant="outline" size="sm" onClick={suggest}>
                  <TrendingUp className="h-3 w-3 mr-1" /> Suggest
                </Button>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{status === "paid" ? "Paid Date" : "Scheduled Date"}</Label>
              <Input type="date" value={scheduled} onChange={e => setScheduled(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment method, reference, remarks..." />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Payout"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PartnerProfitShareWidget;
