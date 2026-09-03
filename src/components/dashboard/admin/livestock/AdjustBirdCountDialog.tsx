import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: any;
  onSaved?: () => void;
  noun?: string;
}

export default function AdjustBirdCountDialog({ open, onOpenChange, batch, onSaved, noun = "animals" }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(String(batch?.current_quantity ?? ""));
  }, [open, batch?.current_quantity]);

  const save = async () => {
    const n = parseInt(value);
    if (!Number.isFinite(n) || n < 0) {
      toast.error(`Enter a valid number of ${noun}`);
      return;
    }
    setSaving(true);
    // keep recorded mortality accounted for, so future deaths still deduct correctly
    const { data: morts } = await supabase
      .from("mortality_records")
      .select("quantity_dead")
      .eq("batch_id", batch.id);
    const deadTotal = (morts || []).reduce((s: number, m: any) => s + Number(m.quantity_dead || 0), 0);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("livestock_batches")
      .update({
        quantity: n + deadTotal,
        current_quantity: n,
        bird_count_confirmed_at: new Date().toISOString(),
        bird_count_confirmed_by: user?.id ?? null,
      } as any)
      .eq("id", batch.id);

    setSaving(false);
    if (error) {
      toast.error("Could not update count");
      return;
    }
    toast.success(`Count updated to ${n}`);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust {noun} count</DialogTitle>
          <DialogDescription>
            Set the real number of {noun} currently in this batch. This replaces the current record
            ({batch?.current_quantity ?? 0}). Recorded mortality keeps deducting automatically from here on.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Current {noun} in this batch</Label>
          <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 480" />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save count
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
