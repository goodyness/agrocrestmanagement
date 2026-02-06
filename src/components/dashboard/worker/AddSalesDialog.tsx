import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, ChevronsUpDown, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useBranch } from "@/contexts/BranchContext";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface AddSalesDialogProps {
  onSuccess: () => void;
}

const AddSalesDialog = ({ onSuccess }: AddSalesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [total, setTotal] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [isPreorder, setIsPreorder] = useState(false);
  const { currentBranchId } = useBranch();
  
  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCustomers();
    }
  }, [open, currentBranchId]);

  const fetchCustomers = async () => {
    let query = supabase.from("customers").select("id, name, phone").eq("is_active", true).order("name");
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data } = await query;
    setCustomers(data || []);
  };

  const handleSelectCustomer = (customerId: string, customerName: string) => {
    setSelectedCustomerId(customerId);
    setBuyerName(customerName);
    setIsNewCustomer(false);
    setCustomerSearchOpen(false);
  };

  const handleNewCustomer = () => {
    setSelectedCustomerId(null);
    setIsNewCustomer(true);
    setCustomerSearchOpen(false);
  };

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

    const totalAmount = quantity * price_per_unit;
    
    // If new customer, create them first
    let customerId = selectedCustomerId;
    if (isNewCustomer && buyer_name) {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: buyer_name,
          branch_id: branchId,
        })
        .select("id")
        .single();
      
      if (customerError) {
        console.error("Failed to create customer:", customerError);
      } else if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    const { error } = await supabase.from("sales_records").insert({
      product_name,
      product_type,
      quantity,
      unit,
      price_per_unit,
      total_amount: totalAmount,
      buyer_name: buyer_name || null,
      recorded_by: user.id,
      date: new Date().toISOString().split('T')[0],
      branch_id: branchId,
      payment_status: isPaid ? 'paid' : 'pending',
      amount_paid: isPaid ? totalAmount : 0,
      delivery_status: isPreorder ? 'preorder' : 'delivered',
      customer_id: customerId,
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
            <Label>Customer</Label>
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between"
                >
                  {buyerName || "Select or add customer..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search customers..." 
                    onValueChange={(value) => {
                      if (!selectedCustomerId) {
                        setBuyerName(value);
                      }
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={handleNewCustomer}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add new customer
                      </Button>
                    </CommandEmpty>
                    <CommandGroup heading="Existing Customers">
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.name}
                          onSelect={() => handleSelectCustomer(customer.id, customer.name)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <p>{customer.name}</p>
                            {customer.phone && (
                              <p className="text-xs text-muted-foreground">{customer.phone}</p>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup>
                      <CommandItem onSelect={handleNewCustomer}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add new customer
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          {isNewCustomer && (
            <div className="space-y-2">
              <Label htmlFor="buyer_name">New Customer Name</Label>
              <Input
                id="buyer_name"
                name="buyer_name"
                type="text"
                placeholder="Enter customer name"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
              />
            </div>
          )}
          
          {!isNewCustomer && !selectedCustomerId && (
            <input type="hidden" name="buyer_name" value={buyerName} />
          )}
          
          {selectedCustomerId && (
            <input type="hidden" name="buyer_name" value={buyerName} />
          )}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="is_paid" 
                checked={isPaid}
                onCheckedChange={(checked) => setIsPaid(checked === true)}
              />
              <Label htmlFor="is_paid" className="text-sm font-normal cursor-pointer">
                Mark as paid
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="is_preorder" 
                checked={isPreorder}
                onCheckedChange={(checked) => setIsPreorder(checked === true)}
              />
              <Label htmlFor="is_preorder" className="text-sm font-normal cursor-pointer">
                Preorder (customer paid but hasn't picked up yet)
              </Label>
            </div>
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
