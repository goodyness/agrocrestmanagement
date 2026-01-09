import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProductionEntry {
  id: string;
  date: string;
  crates: number;
  pieces: number;
  comment: string;
}

interface BulkProductionDialogProps {
  onSuccess: () => void;
}

const BulkProductionDialog = ({ onSuccess }: BulkProductionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [entries, setEntries] = useState<ProductionEntry[]>([
    { id: crypto.randomUUID(), date: today, crates: 0, pieces: 0, comment: "" }
  ]);

  const addEntry = () => {
    setEntries([...entries, { id: crypto.randomUUID(), date: today, crates: 0, pieces: 0, comment: "" }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: string, field: keyof ProductionEntry, value: string | number) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const validEntries = entries.filter(e => e.crates > 0 || e.pieces > 0);
    
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
      date: entry.date,
      crates: entry.crates,
      pieces: entry.pieces,
      comment: entry.comment || null,
      recorded_by: user.id,
    }));

    const { error } = await supabase.from("daily_production").insert(records);

    if (error) {
      toast.error("Failed to add production records");
    } else {
      toast.success(`${validEntries.length} production records added`);
      setOpen(false);
      setEntries([{ id: crypto.randomUUID(), date: today, crates: 0, pieces: 0, comment: "" }]);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <TrendingUp className="h-4 w-4 mr-2" />
          Bulk Production Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Production Recording</DialogTitle>
          <DialogDescription>Record multiple production entries at once</DialogDescription>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateEntry(entry.id, "date", e.target.value)}
                    max={today}
                    required
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Crates</Label>
                  <Input
                    type="number"
                    min="0"
                    value={entry.crates || ""}
                    onChange={(e) => updateEntry(entry.id, "crates", parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pieces</Label>
                  <Input
                    type="number"
                    min="0"
                    value={entry.pieces || ""}
                    onChange={(e) => updateEntry(entry.id, "pieces", parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Comment (Optional)</Label>
                <Textarea
                  value={entry.comment}
                  onChange={(e) => updateEntry(entry.id, "comment", e.target.value)}
                  placeholder="Notes..."
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
            {loading ? "Recording..." : `Record ${entries.filter(e => e.crates > 0 || e.pieces > 0).length} Entries`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkProductionDialog;
