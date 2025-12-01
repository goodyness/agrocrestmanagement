import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface EditFeedTypeDialogProps {
  feedType: any;
  onSuccess: () => void;
}

const EditFeedTypeDialog = ({ feedType, onSuccess }: EditFeedTypeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const feed_name = formData.get("feed_name") as string;
    const unit_type = formData.get("unit_type") as string;
    const price_per_unit = parseFloat(formData.get("price_per_unit") as string);

    const { error } = await supabase
      .from("feed_types")
      .update({
        feed_name,
        unit_type,
        price_per_unit,
      })
      .eq("id", feedType.id);

    if (error) {
      toast.error("Failed to update feed type");
    } else {
      toast.success("Feed type updated successfully");
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Feed Type</DialogTitle>
          <DialogDescription>Update feed details and pricing</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed_name">Feed Name</Label>
            <Input
              id="feed_name"
              name="feed_name"
              type="text"
              defaultValue={feedType.feed_name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_type">Unit Type</Label>
            <select
              id="unit_type"
              name="unit_type"
              defaultValue={feedType.unit_type}
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
              defaultValue={feedType.price_per_unit}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Feed Type"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditFeedTypeDialog;
