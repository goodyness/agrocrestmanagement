import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddFeedPurchaseDialogProps {
  feedTypes: any[];
  onSuccess: () => void;
  branchId: string | null;
}

const AddFeedPurchaseDialog = ({ feedTypes, onSuccess, branchId }: AddFeedPurchaseDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFeedType, setSelectedFeedType] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [pricePerUnit, setPricePerUnit] = useState<string>("");
  const [unit, setUnit] = useState<string>("bags");
  const [notes, setNotes] = useState<string>("");

  const totalCost = parseFloat(quantity || "0") * parseFloat(pricePerUnit || "0");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const feedType = feedTypes.find(f => f.id === selectedFeedType);
    
    if (!feedType) {
      toast.error("Please select a feed type");
      setLoading(false);
      return;
    }

    // Insert feed purchase
    const { error: purchaseError } = await supabase.from("feed_purchases").insert({
      feed_type_id: selectedFeedType,
      quantity: parseFloat(quantity),
      unit,
      price_per_unit: parseFloat(pricePerUnit),
      total_cost: totalCost,
      purchased_by: user.id,
      notes: notes || null,
      branch_id: branchId,
    });

    if (purchaseError) {
      toast.error("Failed to add feed purchase");
      console.error(purchaseError);
      setLoading(false);
      return;
    }

    // Record as expense
    const { error: expenseError } = await supabase.from("miscellaneous_expenses").insert({
      expense_type: "Feed Purchase",
      amount: totalCost,
      description: `Purchased ${quantity} ${unit} of ${feedType.feed_name} @ ₦${parseFloat(pricePerUnit).toLocaleString()}/${unit}`,
      created_by: user.id,
      date: new Date().toISOString().split('T')[0],
      branch_id: branchId,
    });

    if (expenseError) {
      console.error("Expense recording error:", expenseError);
    }

    toast.success("Feed purchase recorded successfully");
    setOpen(false);
    resetForm();
    onSuccess();
    setLoading(false);
  };

  const resetForm = () => {
    setSelectedFeedType("");
    setQuantity("");
    setPricePerUnit("");
    setUnit("bags");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Feed Purchase</DialogTitle>
          <DialogDescription>Record a new feed purchase with pricing</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed_type">Feed Type</Label>
            <select
              id="feed_type"
              value={selectedFeedType}
              onChange={(e) => setSelectedFeedType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g., 40"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="bags">Bags</option>
                <option value="kg">Kilogram (kg)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_per_unit">Price per {unit}</Label>
            <Input
              id="price_per_unit"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 15000"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this purchase..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {quantity && pricePerUnit && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-xl font-bold text-primary">₦{totalCost.toLocaleString()}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Recording..." : "Record Purchase"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFeedPurchaseDialog;
