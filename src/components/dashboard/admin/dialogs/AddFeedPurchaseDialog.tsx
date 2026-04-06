import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";

interface AddFeedPurchaseDialogProps {
  feedTypes: any[];
  onSuccess: () => void;
  branchId: string | null;
}

interface Supplier {
  id: string;
  name: string;
  supplier_type: string;
}

const AddFeedPurchaseDialog = ({ feedTypes, onSuccess, branchId }: AddFeedPurchaseDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFeedType, setSelectedFeedType] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [pricePerUnit, setPricePerUnit] = useState<string>("");
  const [unit, setUnit] = useState<string>("bags");
  const [notes, setNotes] = useState<string>("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [addSupplierMode, setAddSupplierMode] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const totalCost = parseFloat(quantity || "0") * parseFloat(pricePerUnit || "0");

  useEffect(() => {
    if (open) {
      fetchSuppliers();
    }
  }, [open, branchId]);

  const fetchSuppliers = async () => {
    let query = supabase
      .from("suppliers")
      .select("id, name, supplier_type")
      .eq("is_active", true)
      .order("name");
    
    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data } = await query;
    setSuppliers(data || []);
  };

  const handleAddNewSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error("Please enter supplier name");
      return;
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: newSupplierName.trim(),
        phone: newSupplierPhone || null,
        supplier_type: "feed",
        branch_id: branchId,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add supplier");
      console.error(error);
    } else {
      toast.success("Supplier added");
      setSelectedSupplier(data.id);
      setNewSupplierName("");
      setNewSupplierPhone("");
      setAddSupplierMode(false);
      fetchSuppliers();
    }
  };

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

    // Insert feed purchase with supplier_id
    const { error: purchaseError } = await supabase.from("feed_purchases").insert({
      feed_type_id: selectedFeedType,
      quantity: parseFloat(quantity),
      unit,
      price_per_unit: parseFloat(pricePerUnit),
      total_cost: totalCost,
      purchased_by: user.id,
      notes: notes || null,
      branch_id: branchId,
      supplier_id: selectedSupplier || null,
      expiry_date: expiryDate || null,
    });

    if (purchaseError) {
      toast.error("Failed to add feed purchase");
      console.error(purchaseError);
      setLoading(false);
      return;
    }

    // Update feed inventory - add purchased quantity
    const { data: existingInventory } = await supabase
      .from("feed_inventory")
      .select("*")
      .eq("feed_type_id", selectedFeedType)
      .eq("branch_id", branchId)
      .single();

    const purchasedQty = parseFloat(quantity);
    
    if (existingInventory) {
      // Convert quantity to same unit if needed
      let quantityToAdd = purchasedQty;
      
      // If inventory is in bag and purchase is in kg, or vice versa (1 bag = 25kg)
      if (existingInventory.unit === "bag" && unit === "kg") {
        quantityToAdd = purchasedQty / 25;
      } else if (existingInventory.unit === "kg" && unit === "bags") {
        quantityToAdd = purchasedQty * 25;
      } else if (existingInventory.unit === "bags" && unit === "kg") {
        quantityToAdd = purchasedQty / 25;
      } else if (existingInventory.unit === "kg" && unit === "bag") {
        quantityToAdd = purchasedQty * 25;
      }

      const newQuantity = existingInventory.quantity_in_stock + quantityToAdd;
      
      await supabase
        .from("feed_inventory")
        .update({ 
          quantity_in_stock: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingInventory.id);
    } else {
      // Create new inventory record
      await supabase.from("feed_inventory").insert({
        feed_type_id: selectedFeedType,
        quantity_in_stock: purchasedQty,
        unit: unit === "bags" ? "bag" : unit,
        branch_id: branchId,
      });
    }

    // Record supplier pricing history if supplier selected
    if (selectedSupplier) {
      await supabase.from("supplier_pricing_history").insert({
        supplier_id: selectedSupplier,
        feed_type_id: selectedFeedType,
        product_name: feedType.feed_name,
        price_per_unit: parseFloat(pricePerUnit),
        unit: unit === "bags" ? "bag" : unit,
        notes: `Purchase: ${quantity} ${unit}`,
      });
    }

    // Record as expense
    const supplierName = suppliers.find(s => s.id === selectedSupplier)?.name;
    const { error: expenseError } = await supabase.from("miscellaneous_expenses").insert({
      expense_type: "Feed Purchase",
      amount: totalCost,
      description: `Purchased ${quantity} ${unit} of ${feedType.feed_name} @ ₦${parseFloat(pricePerUnit).toLocaleString()}/${unit}${supplierName ? ` from ${supplierName}` : ''}`,
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
    setSelectedSupplier("");
    setAddSupplierMode(false);
    setNewSupplierName("");
    setNewSupplierPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Supplier (Optional)
            </Label>
            {!addSupplierMode ? (
              <div className="space-y-2">
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setAddSupplierMode(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add new supplier
                </Button>
              </div>
            ) : (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Input
                  placeholder="Supplier name"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                />
                <Input
                  placeholder="Phone (optional)"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddNewSupplier}
                  >
                    Save Supplier
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddSupplierMode(false);
                      setNewSupplierName("");
                      setNewSupplierPhone("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
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
            <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
            <Input
              id="expiry_date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
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
