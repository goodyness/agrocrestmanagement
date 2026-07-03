import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  acceptance: any; // batch_acceptances row joined with batch + partner_batch
  onDone: () => void;
}

export default function BatchAcceptanceDialog({ open, onOpenChange, acceptance, onDone }: Props) {
  const b = acceptance?.batch || {};
  const pb = acceptance?.partner_batch || {};
  const [mode, setMode] = useState<"idle" | "accepting" | "disputing">("idle");
  const [contribution, setContribution] = useState<string>("0");
  const [complaint, setComplaint] = useState("");
  const [saving, setSaving] = useState(false);

  if (!acceptance) return null;

  const accept = async () => {
    const amt = parseFloat(contribution) || 0;
    setSaving(true);
    const { error } = await supabase
      .from("batch_acceptances")
      .update({
        status: "accepted",
        partner_contribution: amt,
        accepted_budget: Number(b.budget || 0),
        admin_contribution_snapshot: Number(b.admin_contribution || 0),
        resolved_at: new Date().toISOString(),
      })
      .eq("id", acceptance.id);
    if (!error && pb.id && amt > 0) {
      await supabase.from("partner_batches").update({ partner_contribution: amt }).eq("id", pb.id);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Batch accepted. Welcome aboard!");
    onDone();
  };

  const dispute = async () => {
    if (complaint.trim().length < 5) return toast.error("Please describe the issue");
    setSaving(true);
    const { error } = await supabase
      .from("batch_acceptances")
      .update({ status: "disputed", notes: complaint.slice(0, 1000) })
      .eq("id", acceptance.id);
    if (!error) {
      await supabase.from("batch_complaints").insert([{
        acceptance_id: acceptance.id,
        batch_id: acceptance.batch_id,
        partner_id: acceptance.partner_id,
        message: complaint.slice(0, 1000),
      }] as any);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Complaint filed. Admin will be notified.");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Assigned Batch</DialogTitle>
          <DialogDescription className="text-xs">Confirm these details are correct or lodge a complaint.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="font-semibold capitalize">{b.species_type || b.species}</p>
              <Badge variant="outline">{b.stage}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Quantity:</span> <b>{b.quantity}</b></div>
              <div><span className="text-muted-foreground">Acquired:</span> <b>{b.date_acquired}</b></div>
              <div><span className="text-muted-foreground">Total Budget:</span> <b>₦{Number(b.budget || 0).toLocaleString()}</b></div>
              <div><span className="text-muted-foreground">Admin Contribution:</span> <b>₦{Number(b.admin_contribution || 0).toLocaleString()}</b></div>
              <div><span className="text-muted-foreground">Ownership %:</span> <b>{pb.share_percentage}%</b></div>
              <div><span className="text-muted-foreground">Profit Share %:</span> <b>{pb.profit_share_percentage ?? pb.share_percentage}%</b></div>
            </div>
          </div>

          {mode === "idle" && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setMode("accepting")}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setMode("disputing")}>
                <AlertTriangle className="h-4 w-4 mr-1" /> Dispute
              </Button>
            </div>
          )}

          {mode === "accepting" && (
            <div className="space-y-2 border-t pt-3">
              <Label>Your Contribution (₦)</Label>
              <Input type="number" min={0} value={contribution} onChange={(e) => setContribution(e.target.value)} />
              <p className="text-xs text-muted-foreground">How much are you putting into this batch? Enter 0 if none.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("idle")}>Back</Button>
                <Button className="flex-1" onClick={accept} disabled={saving}>{saving ? "Saving..." : "Confirm & Accept"}</Button>
              </div>
            </div>
          )}

          {mode === "disputing" && (
            <div className="space-y-2 border-t pt-3">
              <Label>What's wrong?</Label>
              <Textarea rows={4} value={complaint} onChange={(e) => setComplaint(e.target.value)} maxLength={1000} placeholder="Describe what needs correcting..." />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("idle")}>Back</Button>
                <Button variant="destructive" className="flex-1" onClick={dispute} disabled={saving}>{saving ? "Filing..." : "File Complaint"}</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
