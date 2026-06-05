import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, AlertTriangle, Egg } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useBranch } from "@/contexts/BranchContext";

interface AddProductionDialogProps {
  onSuccess: () => void;
}

export const CRACK_REASONS = [
  "Rough handling",
  "Transport / Movement",
  "Hen pecking",
  "Thin / weak shell",
  "Equipment (cage, belt)",
  "Overcrowding",
  "Stepped on in nest",
  "Other",
];

const AddProductionDialog = ({ onSuccess }: AddProductionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eggType, setEggType] = useState<"good" | "cracked">("good");
  const [crackReason, setCrackReason] = useState("");
  const [crackDetail, setCrackDetail] = useState("");
  const { currentBranchId } = useBranch();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (eggType === "cracked" && !crackReason) {
      toast.error("Please select a reason for the cracked eggs");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const crates = parseInt(formData.get("crates") as string) || 0;
    const pieces = parseInt(formData.get("pieces") as string) || 0;
    const comment = formData.get("comment") as string;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be logged in"); setLoading(false); return; }

    let branchId = currentBranchId;
    if (!branchId) {
      const { data: profile } = await supabase.from("profiles").select("branch_id").eq("id", user.id).single();
      branchId = profile?.branch_id || null;
    }

    const finalCrackReason =
      eggType === "cracked"
        ? crackDetail.trim()
          ? `${crackReason} — ${crackDetail.trim()}`
          : crackReason
        : null;

    const { error } = await supabase.from("daily_production").insert({
      crates,
      pieces,
      comment: comment || null,
      recorded_by: user.id,
      date: new Date().toISOString().split("T")[0],
      branch_id: branchId,
      egg_type: eggType,
      crack_reason: finalCrackReason,
    } as any);

    if (error) {
      toast.error("Failed to add production record");
    } else {
      await logActivity("create", "daily_production", undefined, {
        crates, pieces, total_eggs: crates * 30 + pieces, egg_type: eggType, crack_reason: finalCrackReason,
      }, branchId);
      toast.success(eggType === "cracked" ? "Cracked eggs recorded" : "Production recorded successfully");
      setOpen(false);
      setEggType("good");
      setCrackReason("");
      setCrackDetail("");
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="default">
          <TrendingUp className="h-4 w-4 mr-2" />
          Add Production
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Daily Production</DialogTitle>
          <DialogDescription>Enter today's egg production</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Egg Type</Label>
            <RadioGroup
              value={eggType}
              onValueChange={(v) => setEggType(v as "good" | "cracked")}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="egg-good"
                className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${eggType === "good" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <RadioGroupItem value="good" id="egg-good" />
                <Egg className="h-4 w-4 text-success" />
                <span>Good Eggs</span>
              </Label>
              <Label
                htmlFor="egg-cracked"
                className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${eggType === "cracked" ? "border-destructive bg-destructive/5" : "border-border"}`}
              >
                <RadioGroupItem value="cracked" id="egg-cracked" />
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span>Cracked Eggs</span>
              </Label>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="crates">Crates</Label>
              <Input id="crates" name="crates" type="number" min="0" placeholder="0" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pieces">Pieces</Label>
              <Input id="pieces" name="pieces" type="number" min="0" placeholder="0" defaultValue="0" />
            </div>
          </div>

          {eggType === "cracked" && (
            <div className="space-y-3 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
              <div className="space-y-2">
                <Label htmlFor="crack-reason">Reason for cracks <span className="text-destructive">*</span></Label>
                <Select value={crackReason} onValueChange={setCrackReason}>
                  <SelectTrigger id="crack-reason"><SelectValue placeholder="Select cause" /></SelectTrigger>
                  <SelectContent>
                    {CRACK_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="crack-detail">Details (optional)</Label>
                <Textarea
                  id="crack-detail"
                  value={crackDetail}
                  onChange={(e) => setCrackDetail(e.target.value)}
                  placeholder="Add specifics — pen, time, who handled, etc."
                  className="h-16"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comment">Comment (Optional)</Label>
            <Textarea id="comment" name="comment" placeholder="Any notes..." />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Recording..." : "Record Production"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductionDialog;
