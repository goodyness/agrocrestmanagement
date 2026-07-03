import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profileId: string;
  available: number;
  onDone: () => void;
}

export default function WithdrawalRequestDialog({ open, onOpenChange, profileId, available, onDone }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 5000) return toast.error("Minimum withdrawal is ₦5,000");
    if (amt > available) return toast.error("Amount exceeds available balance");
    setSaving(true);
    const { error } = await supabase.from("wallet_withdrawals").insert([{
      profile_id: profileId,
      amount: amt,
      request_note: note.slice(0, 500) || null,
      status: "pending",
    }] as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal request submitted");
    setAmount(""); setNote("");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="text-xl font-bold">₦{available.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <Label>Amount (₦)</Label>
            <Input type="number" min={5000} max={available} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Minimum ₦5,000. Admin will review and approve.</p>
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Submitting..." : "Submit Request"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
