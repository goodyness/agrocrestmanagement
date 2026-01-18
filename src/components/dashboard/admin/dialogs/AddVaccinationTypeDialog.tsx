import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddVaccinationTypeDialogProps {
  onSuccess: () => void;
  branchId: string | null;
}

const AddVaccinationTypeDialog = ({ onSuccess, branchId }: AddVaccinationTypeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intervalWeeks, setIntervalWeeks] = useState(3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("vaccination_types")
      .insert({
        name,
        description: description || null,
        interval_weeks: intervalWeeks,
        branch_id: branchId,
      });

    if (error) {
      toast.error("Failed to add vaccination type");
    } else {
      toast.success("Vaccination type added!");
      setOpen(false);
      setName("");
      setDescription("");
      setIntervalWeeks(3);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vaccination Type</DialogTitle>
          <DialogDescription>Create a new vaccination or supplement type</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Multivitamin, Antibiotics"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the vaccination..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Interval (weeks)</Label>
            <Input
              id="interval"
              type="number"
              min="1"
              max="52"
              value={intervalWeeks}
              onChange={(e) => setIntervalWeeks(parseInt(e.target.value) || 3)}
              required
            />
            <p className="text-xs text-muted-foreground">How often this should be administered</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Vaccination Type"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddVaccinationTypeDialog;