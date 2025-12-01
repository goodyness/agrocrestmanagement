import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddFeedInventoryDialogProps {
  feedTypes: any[];
  onSuccess: () => void;
}

const AddFeedInventoryDialog = ({ feedTypes, onSuccess }: AddFeedInventoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const feed_type_id = formData.get("feed_type") as string;
    const quantity_in_stock = parseFloat(formData.get("quantity") as string);
    const unit = formData.get("unit") as string;

    // Get user and feed type details
    const { data: { user } } = await supabase.auth.getUser();
    const feedType = feedTypes.find(f => f.id === feed_type_id);
    
    if (!user || !feedType) {
      toast.error("Missing required information");
      setLoading(false);
      return;
    }

    // Calculate total cost
    const totalCost = quantity_in_stock * feedType.price_per_unit;

    // Insert inventory
    const { error: inventoryError } = await supabase.from("feed_inventory").insert({
      feed_type_id,
      quantity_in_stock,
      unit,
    });

    if (inventoryError) {
      toast.error("Failed to add inventory");
      setLoading(false);
      return;
    }

    // Record as expense
    const { error: expenseError } = await supabase.from("miscellaneous_expenses").insert({
      expense_type: "Feed Purchase",
      amount: totalCost,
      description: `Purchased ${quantity_in_stock} ${unit} of ${feedType.feed_name} @ ₦${feedType.price_per_unit}/${feedType.unit_type}`,
      created_by: user.id,
      date: new Date().toISOString().split('T')[0],
    });

    if (expenseError) {
      toast.error("Inventory added but failed to record expense");
    } else {
      toast.success("Inventory and expense recorded successfully");
    }

    setOpen(false);
    onSuccess();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Update Inventory
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Feed Inventory</DialogTitle>
          <DialogDescription>Add or update feed stock levels</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed_type">Feed Type</Label>
            <select
              id="feed_type"
              name="feed_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">Select feed type</option>
              {feedTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.feed_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity in Stock</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <select
              id="unit"
              name="unit"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="kg">Kilogram (kg)</option>
              <option value="bags">Bags</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Inventory"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFeedInventoryDialog;