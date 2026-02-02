import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Adjustment {
  id: string;
  adjustment_type: string;
  crates: number;
  pieces: number;
  description: string | null;
}

interface EditAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjustment: Adjustment | null;
  onSave: (data: { adjustment_type: string; crates: number; pieces: number; description: string | null }) => void;
  loading?: boolean;
}

const ADJUSTMENT_TYPES = [
  { value: "breakage", label: "Breakage" },
  { value: "spoilage", label: "Spoilage" },
  { value: "given_away", label: "Given Away" },
  { value: "theft", label: "Theft/Loss" },
  { value: "counting_error", label: "Counting Error" },
  { value: "other", label: "Other" },
];

const EditAdjustmentDialog = ({ open, onOpenChange, adjustment, onSave, loading }: EditAdjustmentDialogProps) => {
  const [form, setForm] = useState({
    adjustment_type: "breakage",
    crates: "",
    pieces: "",
    description: "",
  });

  useEffect(() => {
    if (adjustment) {
      setForm({
        adjustment_type: adjustment.adjustment_type,
        crates: adjustment.crates.toString(),
        pieces: adjustment.pieces.toString(),
        description: adjustment.description || "",
      });
    }
  }, [adjustment]);

  const handleSave = () => {
    onSave({
      adjustment_type: form.adjustment_type,
      crates: parseInt(form.crates) || 0,
      pieces: parseInt(form.pieces) || 0,
      description: form.description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Adjustment</DialogTitle>
          <DialogDescription>Modify the stock adjustment details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Adjustment Type</Label>
            <Select 
              value={form.adjustment_type} 
              onValueChange={(v) => setForm({ ...form, adjustment_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Crates</Label>
              <Input
                type="number"
                min="0"
                value={form.crates}
                onChange={(e) => setForm({ ...form, crates: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Pieces</Label>
              <Input
                type="number"
                min="0"
                value={form.pieces}
                onChange={(e) => setForm({ ...form, pieces: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Additional details..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAdjustmentDialog;
