import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addWeeks, format } from "date-fns";
import { logActivity } from "@/lib/activityLogger";

interface AddVaccinationDialogProps {
  vaccinationTypes: any[];
  categories: any[];
  onSuccess: () => void;
}

const AddVaccinationDialog = ({ vaccinationTypes, categories, onSuccess }: AddVaccinationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vaccinationTypeId, setVaccinationTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const selectedType = vaccinationTypes.find(t => t.id === vaccinationTypeId);
    const intervalWeeks = selectedType?.interval_weeks || 3;
    const nextDueDate = format(addWeeks(new Date(date), intervalWeeks), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("vaccination_records")
      .insert({
        vaccination_type_id: vaccinationTypeId,
        livestock_category_id: categoryId,
        administered_date: date,
        next_due_date: nextDueDate,
        administered_by: user.id,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to record vaccination");
    } else {
      const selectedCategory = categories.find(c => c.id === categoryId);
      await logActivity(
        "created",
        "vaccination",
        data.id,
        { 
          vaccination_type: selectedType?.name,
          livestock_category: selectedCategory?.name,
          date 
        }
      );
      toast.success("Vaccination recorded!");
      setOpen(false);
      setVaccinationTypeId("");
      setCategoryId("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
      onSuccess();
    }

    setLoading(false);
  };

  const selectedType = vaccinationTypes.find(t => t.id === vaccinationTypeId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Record Vaccination
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Vaccination</DialogTitle>
          <DialogDescription>Log a vaccination or supplement administration</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Livestock Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vaccination Type</Label>
            <Select value={vaccinationTypeId} onValueChange={setVaccinationTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select vaccination" />
              </SelectTrigger>
              <SelectContent>
                {vaccinationTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} (every {type.interval_weeks} weeks)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date Administered</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {selectedType && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Next due: <span className="font-medium text-foreground">
                  {format(addWeeks(new Date(date), selectedType.interval_weeks), "MMM dd, yyyy")}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !categoryId || !vaccinationTypeId}>
            {loading ? "Recording..." : "Record Vaccination"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddVaccinationDialog;