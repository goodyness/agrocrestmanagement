import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useBranch } from "@/contexts/BranchContext";

interface AddSalesDialogProps {
  onSuccess: () => void;
}

const AddSalesDialog = ({ onSuccess }: AddSalesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [total, setTotal] = useState(0);
  const { currentBranchId } = useBranch();

  const calculateTotal = (qty: string, price: string) => {
    const q = parseFloat(qty) || 0;
    const p = parseFloat(price) || 0;
    setTotal(q * p);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const product_name = formData.get("product_name") as string;
    const product_type = formData.get("product_type") as string;
    const quantity = parseFloat(formData.get("quantity") as string);
    const unit = formData.get("unit") as string;
    const price_per_unit = parseFloat(formData.get("price_per_unit") as string);
    const buyer_name = formData.get("buyer_name") as string;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    // Get user's branch_id from profile if no currentBranchId
    let branchId = currentBranchId;
    if (!branchId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .single();
      branchId = profile?.branch_id || null;
    }

    const { error } = await supabase.from("sales_records").insert({
      product_name,
      product_type,
      quantity,
      unit,
      price_per_unit,
      total_amount: quantity * price_per_unit,
      buyer_name: buyer_name || null,
      recorded_by: user.id,
      date: new Date().toISOString().split('T')[0],
      branch_id: branchId,
    });

    if (error) {
      toast.error("Failed to add sales record");
    } else {
      await logActivity("create", "sales", undefined, {
        product_name,
        product_type,
        quantity: `${quantity} ${unit}`,
        total_amount: quantity * price_per_unit,
        buyer: buyer_name || 'Unknown',
      }, branchId);
      
      toast.success("Sale recorded successfully");
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="default">
          <DollarSign className="h-4 w-4 mr-2" />
          Add Sales
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Sale</DialogTitle>
          <DialogDescription>Enter sales transaction details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              id="product_name"
              name="product_name"
              type="text"
              placeholder="e.g., Fresh Eggs"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product_type">Product Type</Label>
            <select
              id="product_type"
              name="product_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">Select type</option>
              <option value="Eggs">Eggs</option>
              <option value="Chicken">Chicken</option>
              <option value="Goat">Goat</option>
              <option value="Goat Meat">Goat Meat</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  calculateTotal(e.target.value, pricePerUnit);
                }}
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
                <option value="crates">Crates</option>
                <option value="kg">Kg</option>
                <option value="birds">Birds</option>
                <option value="pieces">Pieces</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_per_unit">Price per Unit (₦)</Label>
            <Input
              id="price_per_unit"
              name="price_per_unit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={pricePerUnit}
              onChange={(e) => {
                setPricePerUnit(e.target.value);
                calculateTotal(quantity, e.target.value);
              }}
              required
            />
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Total Amount:</p>
            <p className="text-2xl font-bold text-primary">₦{total.toLocaleString()}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer_name">Buyer Name (Optional)</Label>
            <Input
              id="buyer_name"
              name="buyer_name"
              type="text"
              placeholder="Customer name"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Recording..." : "Record Sale"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSalesDialog;
