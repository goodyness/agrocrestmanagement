import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddFeedTypeDialogProps {
  onSuccess: () => void;
  branchId: string | null;
}

const AddFeedTypeDialog = ({ onSuccess, branchId }: AddFeedTypeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const feed_name = formData.get("feed_name") as string;
    const unit_type = formData.get("unit_type") as string;
    const price_per_unit = parseFloat(formData.get("price_per_unit") as string);

    const { error } = await supabase.from("feed_types").insert({
      feed_name,
      unit_type,
      price_per_unit,
      branch_id: branchId,
    });

    if (error) {
      toast.error("Failed to add feed type");
    } else {
      toast.success("Feed type added successfully");
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Feed Type
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Feed Type</DialogTitle>
          <DialogDescription>Define a new type of feed and its pricing</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed_name">Feed Name</Label>
            <Input
              id="feed_name"
              name="feed_name"
              type="text"
              placeholder="e.g., Broiler Starter, Layer Feed"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_type">Unit Type</Label>
            <select
              id="unit_type"
              name="unit_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="kg">Kilogram (kg)</option>
              <option value="bag">Bag</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_per_unit">Price per Unit (₦)</Label>
            <Input
              id="price_per_unit"
              name="price_per_unit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Feed Type"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFeedTypeDialog;