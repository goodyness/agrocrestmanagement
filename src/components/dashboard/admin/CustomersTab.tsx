import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Phone, Mail, MapPin, Users, ShoppingBag, TrendingUp, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  customer_type: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  total_purchases?: number;
  total_paid?: number;
}

interface SalesRecord {
  id: string;
  date: string;
  product_name: string;
  quantity: number;
  unit: string;
  total_amount: number;
  payment_status: string;
}

const CustomersTab = () => {
  const { currentBranchId } = useBranch();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<SalesRecord[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [unmatchedBuyers, setUnmatchedBuyers] = useState<{ name: string; count: number; total: number }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    customer_type: "regular",
    notes: "",
  });

  useEffect(() => {
    fetchCustomers();
    fetchUnmatchedBuyers();
  }, [currentBranchId]);

  const fetchUnmatchedBuyers = async () => {
    // Get sales with buyer_name but no customer_id
    let query = supabase
      .from("sales_records")
      .select("buyer_name, total_amount")
      .not("buyer_name", "is", null)
      .is("customer_id", null);
    
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    
    const { data } = await query;
    
    if (data && data.length > 0) {
      // Group by buyer_name and calculate stats
      const grouped = data.reduce((acc, sale) => {
        const name = sale.buyer_name?.trim();
        if (!name) return acc;
        if (!acc[name]) {
          acc[name] = { count: 0, total: 0 };
        }
        acc[name].count += 1;
        acc[name].total += Number(sale.total_amount);
        return acc;
      }, {} as Record<string, { count: number; total: number }>);
      
      const buyerList = Object.entries(grouped).map(([name, stats]) => ({
        name,
        count: stats.count,
        total: stats.total,
      })).sort((a, b) => b.count - a.count);
      
      setUnmatchedBuyers(buyerList);
    } else {
      setUnmatchedBuyers([]);
    }
  };

  const handleImportBuyer = async (buyerName: string) => {
    setImportLoading(true);
    
    // Check if customer already exists with this name
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .ilike("name", buyerName)
      .eq("branch_id", currentBranchId)
      .single();
    
    let customerId: string;
    
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
          name: buyerName,
          customer_type: "regular",
          branch_id: currentBranchId,
        })
        .select()
        .single();
      
      if (error || !newCustomer) {
        toast.error("Failed to create customer");
        setImportLoading(false);
        return;
      }
      customerId = newCustomer.id;
    }
    
    // Link all sales with this buyer_name to the customer
    const { error: updateError } = await supabase
      .from("sales_records")
      .update({ customer_id: customerId })
      .eq("buyer_name", buyerName)
      .is("customer_id", null);
    
    if (updateError) {
      toast.error("Failed to link sales");
      console.error(updateError);
    } else {
      toast.success(`Imported "${buyerName}" as customer`);
      fetchCustomers();
      fetchUnmatchedBuyers();
    }
    
    setImportLoading(false);
  };

  const handleImportAll = async () => {
    setImportLoading(true);
    
    for (const buyer of unmatchedBuyers) {
      await handleImportBuyer(buyer.name);
    }
    
    toast.success("All buyers imported successfully");
    setImportDialogOpen(false);
    setImportLoading(false);
  };

  const fetchCustomers = async () => {
    let query = supabase.from("customers").select("*").order("name");
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data: customersData } = await query;

    // Fetch sales totals for each customer
    if (customersData) {
      const customersWithTotals = await Promise.all(
        customersData.map(async (customer) => {
          let salesQuery = supabase
            .from("sales_records")
            .select("total_amount, amount_paid")
            .eq("customer_id", customer.id);
          if (currentBranchId) salesQuery = salesQuery.eq("branch_id", currentBranchId);
          const { data: sales } = await salesQuery;

          const total_purchases = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
          const total_paid = sales?.reduce((acc, s) => acc + Number(s.amount_paid), 0) || 0;

          return { ...customer, total_purchases, total_paid };
        })
      );
      setCustomers(customersWithTotals);
    } else {
      setCustomers([]);
    }
  };

  const fetchCustomerSales = async (customerId: string) => {
    let query = supabase
      .from("sales_records")
      .select("id, date, product_name, quantity, unit, total_amount, payment_status")
      .eq("customer_id", customerId)
      .order("date", { ascending: false })
      .limit(20);
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data } = await query;
    setCustomerSales(data || []);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("customers").insert({
      ...formData,
      branch_id: currentBranchId,
    });

    if (error) {
      toast.error("Failed to add customer");
      console.error(error);
    } else {
      toast.success("Customer added successfully");
      setAddDialogOpen(false);
      resetForm();
      fetchCustomers();
    }
    setLoading(false);
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setLoading(true);

    const { error } = await supabase
      .from("customers")
      .update(formData)
      .eq("id", selectedCustomer.id);

    if (error) {
      toast.error("Failed to update customer");
      console.error(error);
    } else {
      toast.success("Customer updated successfully");
      setEditDialogOpen(false);
      resetForm();
      fetchCustomers();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", address: "", customer_type: "regular", notes: "" });
    setSelectedCustomer(null);
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      customer_type: customer.customer_type,
      notes: customer.notes || "",
    });
    setEditDialogOpen(true);
  };

  const viewCustomerSales = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchCustomerSales(customer.id);
  };

  // Calculate summary stats
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((acc, c) => acc + (c.total_purchases || 0), 0);
  const totalOwed = customers.reduce((acc, c) => acc + ((c.total_purchases || 0) - (c.total_paid || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Customer Management</h2>
          <p className="text-muted-foreground">Track customers and their purchase history</p>
        </div>
        <div className="flex gap-2">
          {unmatchedBuyers.length > 0 && (
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import from Sales ({unmatchedBuyers.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Buyers from Sales History</DialogTitle>
                  <DialogDescription>
                    These buyers were found in sales records but aren't linked to customer accounts yet.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {unmatchedBuyers.map((buyer) => (
                    <div
                      key={buyer.name}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{buyer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {buyer.count} purchase(s) • ₦{buyer.total.toLocaleString()} total
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleImportBuyer(buyer.name)}
                        disabled={importLoading}
                      >
                        Import
                      </Button>
                    </div>
                  ))}
                </div>
                {unmatchedBuyers.length > 1 && (
                  <Button
                    className="w-full mt-4"
                    onClick={handleImportAll}
                    disabled={importLoading}
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>Import All ({unmatchedBuyers.length} buyers)</>
                    )}
                  </Button>
                )}
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>Add a new customer to your database</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mrs. Adebayo"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08012345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.customer_type}
                    onValueChange={(v) => setFormData({ ...formData, customer_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="retailer">Retailer</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding..." : "Add Customer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₦{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-destructive" />
              Outstanding Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">₦{totalOwed.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customers ({customers.length})
            </CardTitle>
            <CardDescription>Click on a customer to view their purchase history</CardDescription>
          </CardHeader>
          <CardContent>
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No customers added yet. Add your first customer above.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {customers.map((customer) => {
                  const owed = (customer.total_purchases || 0) - (customer.total_paid || 0);
                  return (
                    <div
                      key={customer.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedCustomer?.id === customer.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => viewCustomerSales(customer)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{customer.name}</p>
                            <Badge variant={customer.customer_type === "wholesale" ? "default" : "secondary"}>
                              {customer.customer_type}
                            </Badge>
                          </div>
                          {customer.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              Purchased: <span className="font-medium text-foreground">₦{(customer.total_purchases || 0).toLocaleString()}</span>
                            </span>
                            {owed > 0 && (
                              <span className="text-destructive">
                                Owes: ₦{owed.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(customer);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Purchase History
            </CardTitle>
            <CardDescription>
              {selectedCustomer ? `For ${selectedCustomer.name}` : "Select a customer to view history"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCustomer ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a customer to view their purchase history</p>
              </div>
            ) : customerSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No purchase history yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-sm">
                        {new Date(sale.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{sale.product_name}</span>
                        <span className="text-muted-foreground text-sm ml-1">
                          ({sale.quantity} {sale.unit})
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₦{Number(sale.total_amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sale.payment_status === "paid"
                              ? "default"
                              : sale.payment_status === "partial"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {sale.payment_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCustomer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Customer Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={formData.customer_type}
                  onValueChange={(v) => setFormData({ ...formData, customer_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="retailer">Retailer</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Customer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomersTab;
