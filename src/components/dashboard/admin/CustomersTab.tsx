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
import { Plus, Edit2, Phone, Mail, MapPin, Users, ShoppingBag, TrendingUp, Upload, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { outstanding } from "@/lib/batchTools";
import { customerEmailSchema } from "@/lib/customerEmail";

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
  credit_limit?: number | null;
  payment_terms_days?: number;
}

interface SalesRecord {
  id: string;
  date: string;
  product_name: string;
  quantity: number;
  unit: string;
  total_amount: number;
  payment_status: string;
  amount_paid: number;
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
  const [reminding, setReminding] = useState<string | null>(null);
  const [paymentSale, setPaymentSale] = useState<SalesRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [emailReminder, setEmailReminder] = useState<{ customer: Customer } | null>(null);
  const [reminderEmail, setReminderEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    customer_type: "regular",
    notes: "",
    credit_limit: "",
    payment_terms_days: "14",
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
            .select("total_amount, amount_paid, payment_status")
            .eq("customer_id", customer.id);
          if (currentBranchId) salesQuery = salesQuery.eq("branch_id", currentBranchId);
          const { data: sales } = await salesQuery;

          const total_purchases = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
          const total_paid = sales?.reduce((acc, s) => acc + Number(s.total_amount) - outstanding(s), 0) || 0;

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
      .select("id, date, product_name, quantity, unit, total_amount, payment_status, amount_paid")
      .eq("customer_id", customerId)
      .order("date", { ascending: false });
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data } = await query;
    setCustomerSales(data || []);
    setHistoryPage(1);
  };

  const unpaidSales = customerSales.filter(s => outstanding(s) > 0);
  const unpaidTotal = unpaidSales.reduce((a, s) => a + outstanding(s), 0);
  const deliverReminder = async (customer: Customer) => {
    setReminding(customer.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-customer-payment-reminder", { body: { customerId: customer.id } });
      if (error) { const context = error.context; const details = context instanceof Response ? await context.json().catch(() => null) : null; toast.error(details?.error || "Could not send payment reminder"); }
      else if (data?.error) toast.error(data.error); else toast.success(`Reminder sent covering ${data?.count ?? unpaidSales.length} unpaid purchase(s)`);
    } catch { toast.error("Could not send payment reminder. Your saved email is available for retry."); }
    finally { setReminding(null); }
  };
  const sendReminder = async () => {
    if (!selectedCustomer) return;
    if (!customerEmailSchema.safeParse(selectedCustomer.email || "").success) {
      setEmailReminder({ customer: selectedCustomer });
      setReminderEmail(selectedCustomer.email || ""); setEmailError("");
      return;
    }
    if (!window.confirm(`Send one reminder to ${selectedCustomer.name} covering ${unpaidSales.length} unpaid purchase(s) totalling ₦${unpaidTotal.toLocaleString()}?`)) return;
    await deliverReminder(selectedCustomer);
  };
  const saveEmailAndSend = async (e: React.FormEvent) => {
    e.preventDefault(); if (!emailReminder || savingEmail) return;
    const parsed = customerEmailSchema.safeParse(reminderEmail);
    if (!parsed.success) { setEmailError("Enter a valid email address"); return; }
    setSavingEmail(true); setEmailError("");
    try {
      const { data, error } = await supabase.from("customers").update({ email: parsed.data }).eq("id", emailReminder.customer.id).select("id").single();
      if (error || !data) { setEmailError("Could not save this email. Please try again."); return; }
      const updated = { ...emailReminder.customer, email: parsed.data };
      setCustomers(previous => previous.map(c => c.id === updated.id ? { ...c, email: parsed.data } : c));
      setSelectedCustomer(previous => previous?.id === updated.id ? { ...previous, email: parsed.data } : previous);
      setEmailReminder(null);
      await deliverReminder(updated);
    } catch { setEmailError("Could not save this email. Please try again."); }
    finally { setSavingEmail(false); }
  };
  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!paymentSale) return;
    const added = Number(paymentAmount); const owed = outstanding(paymentSale);
    if (!(added > 0) || added > owed) return toast.error("Payment must be positive and not exceed the balance");
    setLoading(true);
    const paid = Number(paymentSale.total_amount) - owed + added;
    const status = paid >= Number(paymentSale.total_amount) ? "paid" : "partial";
    const { error } = await supabase.from("sales_records").update({ amount_paid: paid, payment_status: status }).eq("id", paymentSale.id);
    if (error) toast.error(error.message);
    else {
      const { error: linkedError } = await supabase.from("batch_sales").update({ amount_paid: paid, payment_status: status }).eq("sales_record_id", paymentSale.id);
      if (linkedError) toast.error("Payment saved; linked batch payment could not be updated"); else toast.success("Payment recorded");
      setPaymentSale(null); setPaymentAmount(""); fetchCustomers(); if (selectedCustomer) fetchCustomerSales(selectedCustomer.id);
    }
    setLoading(false);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("customers").insert({
      ...formData,
      credit_limit: formData.credit_limit === "" ? null : Number(formData.credit_limit),
      payment_terms_days: Number(formData.payment_terms_days),
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
      .update({ ...formData, credit_limit: formData.credit_limit === "" ? null : Number(formData.credit_limit), payment_terms_days: Number(formData.payment_terms_days) })
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

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      // Check for foreign key constraint violation (usually code 23503 in Postgres)
      if (error.code === '23503' || error.message?.includes('violates foreign key constraint') || error.message?.includes('linked')) {
        toast.error(`Cannot delete ${name} because they have existing sales records. You must delete their sales first.`);
      } else {
        toast.error(`Failed to delete ${name}.`);
      }
    } else {
      toast.success(`${name} deleted successfully`);
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
        setCustomerSales([]);
      }
      fetchCustomers();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", address: "", customer_type: "regular", notes: "", credit_limit: "", payment_terms_days: "14" });
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
      credit_limit: customer.credit_limit == null ? "" : String(customer.credit_limit),
      payment_terms_days: String(customer.payment_terms_days ?? 14),
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
                <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="customer-credit">Credit limit (₦)</Label><Input id="customer-credit" type="number" min={0} step="0.01" placeholder="No limit" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: e.target.value })}/></div><div><Label htmlFor="customer-terms">Payment terms (days)</Label><Input id="customer-terms" type="number" min={0} max={365} required value={formData.payment_terms_days} onChange={e => setFormData({ ...formData, payment_terms_days: e.target.value })}/></div></div>
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
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedCustomer?.id === customer.id
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
                          {customer.email && <p className="text-xs text-muted-foreground mt-1 break-all">{customer.email}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Credit limit: {customer.credit_limit == null ? "Not set" : `₦${Number(customer.credit_limit).toLocaleString()}`} · {customer.payment_terms_days ?? 14} day terms</p>
                          {customer.credit_limit != null && owed > Number(customer.credit_limit) && <Badge variant="destructive" className="mt-1">Over credit limit</Badge>}
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(customer);
                            }}
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomer(customer.id, customer.name);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
            {selectedCustomer && unpaidSales.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-3">
                <p className="text-sm"><b>{unpaidSales.length}</b> unpaid purchase(s) · <b>₦{unpaidTotal.toLocaleString()}</b> outstanding</p>
                <Button size="sm" disabled={reminding !== null || savingEmail} onClick={sendReminder}>{reminding ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Mail className="h-4 w-4 mr-2"/>}Send one reminder for all</Button>
              </div>
            )}
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
              <div className="overflow-x-auto"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance / due</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerSales.slice((historyPage - 1) * 15, historyPage * 15).map((sale) => (
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
                      <TableCell className="text-xs whitespace-nowrap">₦{outstanding(sale).toLocaleString()}<br/>{new Date(Date.parse(sale.date) + (selectedCustomer.payment_terms_days ?? 14) * 86400000).toLocaleDateString()}</TableCell>
                      <TableCell>{outstanding(sale) > 0 && <div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => { setPaymentSale(sale); setPaymentAmount(""); }}>Add payment</Button></div>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>{customerSales.length > 15 && <div className="flex gap-3 justify-end mt-3"><Button variant="outline" disabled={historyPage===1} onClick={()=>setHistoryPage(historyPage-1)}>Previous</Button><span>{historyPage} / {Math.ceil(customerSales.length/15)}</span><Button variant="outline" disabled={historyPage*15>=customerSales.length} onClick={()=>setHistoryPage(historyPage+1)}>Next</Button></div>}</div>
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
            <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="edit-customer-credit">Credit limit (₦)</Label><Input id="edit-customer-credit" type="number" min={0} step="0.01" placeholder="No limit" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: e.target.value })}/></div><div><Label htmlFor="edit-customer-terms">Payment terms (days)</Label><Input id="edit-customer-terms" type="number" min={0} max={365} required value={formData.payment_terms_days} onChange={e => setFormData({ ...formData, payment_terms_days: e.target.value })}/></div></div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Customer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(emailReminder)} onOpenChange={open => { if (!open && !savingEmail) setEmailReminder(null); }}><DialogContent><DialogHeader><DialogTitle>Add customer email</DialogTitle><DialogDescription>{emailReminder?.customer.name} · {unpaidSales.length} unpaid purchase(s) · ₦{unpaidTotal.toLocaleString()} outstanding</DialogDescription></DialogHeader><form onSubmit={saveEmailAndSend} noValidate className="space-y-4"><div className="space-y-2"><Label htmlFor="reminder-customer-email">Customer email</Label><Input id="reminder-customer-email" type="email" autoComplete="email" autoFocus value={reminderEmail} disabled={savingEmail} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "reminder-email-error" : undefined} onChange={e=>{setReminderEmail(e.target.value);setEmailError("");}}/>{emailError && <p id="reminder-email-error" role="alert" className="text-sm text-destructive">{emailError}</p>}</div><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={savingEmail} onClick={()=>setEmailReminder(null)}>Cancel</Button><Button type="submit" disabled={savingEmail}>{savingEmail ? "Saving & sending…" : "Save email & send reminder"}</Button></div></form></DialogContent></Dialog>
      <Dialog open={Boolean(paymentSale)} onOpenChange={open => { if (!open) setPaymentSale(null); }}><DialogContent><DialogHeader><DialogTitle>Record customer payment</DialogTitle><DialogDescription>Remaining balance: ₦{paymentSale ? outstanding(paymentSale).toLocaleString() : 0}</DialogDescription></DialogHeader><form onSubmit={recordPayment} className="space-y-4"><Label htmlFor="customer-payment">Amount received (₦)</Label><Input id="customer-payment" type="number" min="0.01" step="0.01" max={paymentSale ? outstanding(paymentSale) : 0} required value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/><Button disabled={loading}>Save payment</Button></form></DialogContent></Dialog>
    </div>
  );
};

export default CustomersTab;
