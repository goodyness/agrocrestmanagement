import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface EditCensusDialogProps {
  census: {
    id: string;
    total_count: number;
    updated_count: number;
    livestock_categories?: { name: string } | null;
  };
  onSuccess: () => void;
}

const EditCensusDialog = ({ census, onSuccess }: EditCensusDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(census.total_count);
  const [updatedCount, setUpdatedCount] = useState(census.updated_count);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("livestock_census")
      .update({
        total_count: totalCount,
        updated_count: updatedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", census.id);

    if (error) {
      toast.error("Failed to update census");
    } else {
      toast.success("Census updated successfully");
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Census: {census.livestock_categories?.name}</DialogTitle>
          <DialogDescription>Update livestock count</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="total">Initial Count</Label>
            <Input
              id="total"
              type="number"
              min="0"
              value={totalCount}
              onChange={(e) => setTotalCount(parseInt(e.target.value) || 0)}
              required
            />
            <p className="text-xs text-muted-foreground">Original count when census was created</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="current">Current Count</Label>
            <Input
              id="current"
              type="number"
              min="0"
              value={updatedCount}
              onChange={(e) => setUpdatedCount(parseInt(e.target.value) || 0)}
              required
            />
            <p className="text-xs text-muted-foreground">Current livestock count (adjusted for mortality)</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Difference: </span>
              <span className={updatedCount < totalCount ? 'text-destructive' : 'text-success'}>
                {updatedCount - totalCount >= 0 ? '+' : ''}{updatedCount - totalCount}
              </span>
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Census"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCensusDialog;
