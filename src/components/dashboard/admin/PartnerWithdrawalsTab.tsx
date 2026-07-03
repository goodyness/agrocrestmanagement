import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function PartnerWithdrawalsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "paid" | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("wallet_withdrawals")
      .select("*, profiles:profile_id(name, email), bank:profile_id(id)")
      .order("requested_at", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const apply = async () => {
    if (!selected || !action) return;
    const { data: { user } } = await supabase.auth.getUser();
    const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "paid";
    const { error } = await supabase.from("wallet_withdrawals").update({
      status, admin_note: note.slice(0, 500) || null,
      resolved_at: new Date().toISOString(), resolved_by: user?.id || null,
    }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success(`Withdrawal ${status}`);
    setSelected(null); setAction(null); setNote(""); load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Partner Withdrawals</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-xs text-muted-foreground py-6 text-center">No withdrawal requests</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Amount</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead>Note</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.profiles?.name || r.profiles?.email}</TableCell>
                    <TableCell className="font-medium">₦{Number(r.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{new Date(r.requested_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={r.status === "paid" || r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{r.request_note || r.admin_note || "—"}</TableCell>
                    <TableCell className="space-x-1">
                      {r.status === "pending" && <>
                        <Button size="sm" variant="outline" onClick={() => { setSelected(r); setAction("approve"); }}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelected(r); setAction("reject"); }}>Reject</Button>
                      </>}
                      {r.status === "approved" && <Button size="sm" onClick={() => { setSelected(r); setAction("paid"); }}>Mark Paid</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected && !!action} onOpenChange={(o) => { if (!o) { setSelected(null); setAction(null); setNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="capitalize">{action} Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Amount: <b>₦{Number(selected?.amount || 0).toLocaleString()}</b></p>
            <Textarea placeholder="Admin note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            <Button className="w-full" onClick={apply}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
