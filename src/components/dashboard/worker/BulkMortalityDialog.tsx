import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MortalityEntry {
  id: string;
  categoryId: string;
  quantity: number;
  reason: string;
}

interface BulkMortalityDialogProps {
  onSuccess: () => void;
}

const BulkMortalityDialog = ({ onSuccess }: BulkMortalityDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [entries, setEntries] = useState<MortalityEntry[]>([
    { id: crypto.randomUUID(), categoryId: "", quantity: 0, reason: "" }
  ]);

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    const { data } = await supabase.from("livestock_categories").select("*");
    setCategories(data || []);
  };

  const addEntry = () => {
    setEntries([...entries, { id: crypto.randomUUID(), categoryId: "", quantity: 0, reason: "" }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: string, field: keyof MortalityEntry, value: string | number) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const validEntries = entries.filter(e => e.categoryId && e.quantity > 0);
    
    if (validEntries.length === 0) {
      toast.error("Please add at least one valid entry");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const records = validEntries.map(entry => ({
      livestock_category_id: entry.categoryId,
      quantity_dead: entry.quantity,
      reason: entry.reason || null,
      recorded_by: user.id,
      date: new Date().toISOString().split('T')[0],
    }));

    const { error } = await supabase.from("mortality_records").insert(records);

    if (error) {
      toast.error("Failed to add mortality records");
    } else {
      toast.success(`${validEntries.length} mortality records added`);
      setOpen(false);
      setEntries([{ id: crypto.randomUUID(), categoryId: "", quantity: 0, reason: "" }]);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <AlertCircle className="h-4 w-4 mr-2" />
          Bulk Mortality Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Mortality Recording</DialogTitle>
          <DialogDescription>Record multiple mortality events at once</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {entries.map((entry, index) => (
            <div key={entry.id} className="p-4 border rounded-lg space-y-3 bg-muted/30">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">Entry {index + 1}</span>
                {entries.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeEntry(entry.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <select
                    value={entry.categoryId}
                    onChange={(e) => updateEntry(entry.id, "categoryId", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    required
                  >
                    <option value="">Select</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity Dead</Label>
                  <Input
                    type="number"
                    min="1"
                    value={entry.quantity || ""}
                    onChange={(e) => updateEntry(entry.id, "quantity", parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason (Optional)</Label>
                <Textarea
                  value={entry.reason}
                  onChange={(e) => updateEntry(entry.id, "reason", e.target.value)}
                  placeholder="Cause of death..."
                  className="h-16"
                />
              </div>
            </div>
          ))}
          
          <Button type="button" variant="outline" className="w-full" onClick={addEntry}>
            <Plus className="h-4 w-4 mr-2" />
            Add Another Entry
          </Button>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Recording..." : `Record ${entries.filter(e => e.categoryId && e.quantity > 0).length} Entries`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkMortalityDialog;
