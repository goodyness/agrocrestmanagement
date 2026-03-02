import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  branchId: string | null;
  batchQuantity: number;
  onSuccess: () => void;
}

const CARE_TYPES = [
  { value: "vaccination", label: "💉 Vaccination" },
  { value: "medication", label: "💊 Medication" },
  { value: "feeding", label: "🌾 Feeding" },
  { value: "supplement", label: "🧴 Supplement / Vitamin" },
  { value: "deworming", label: "🪱 Deworming" },
  { value: "observation", label: "👁️ Observation" },
  { value: "other", label: "📋 Other" },
];

const AddCareLogDialog = ({ open, onOpenChange, batchId, branchId, batchQuantity, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [careType, setCareType] = useState("");
  const [description, setDescription] = useState("");
  const [productName, setProductName] = useState("");
  const [dosage, setDosage] = useState("");
  const [quantityAffected, setQuantityAffected] = useState(batchQuantity);
  const [careDate, setCareDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("livestock_care_logs").insert({
      batch_id: batchId,
      branch_id: branchId,
      care_date: careDate,
      care_type: careType,
      description,
      product_name: productName || null,
      dosage: dosage || null,
      quantity_affected: quantityAffected || null,
      administered_by: user.id,
      notes: notes || null,
    });

    if (error) {
      toast.error("Failed to log care: " + error.message);
    } else {
      toast.success("Care logged successfully!");
      onOpenChange(false);
      setCareType("");
      setDescription("");
      setProductName("");
      setDosage("");
      setNotes("");
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Care Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={careDate} onChange={(e) => setCareDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Care Type *</Label>
            <Select value={careType} onValueChange={setCareType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {CARE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was done..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g., La Sota" />
            </div>
            <div className="space-y-2">
              <Label>Dosage</Label>
              <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g., 1ml per bird" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Animals Affected</Label>
            <Input
              type="number"
              min={0}
              max={batchQuantity}
              value={quantityAffected || ""}
              onChange={(e) => setQuantityAffected(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional observations..." />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !careType || !description}>
            {loading ? "Saving..." : "Log Care Record"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCareLogDialog;
