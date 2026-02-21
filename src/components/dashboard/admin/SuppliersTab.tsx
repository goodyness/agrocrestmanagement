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
import { Plus, Edit2, Phone, Mail, MapPin, History, Truck, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  supplier_type: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface PricingHistory {
  id: string;
  product_name: string;
  price_per_unit: number;
  unit: string;
  effective_date: string;
  notes: string | null;
}

const SuppliersTab = () => {
  const { currentBranchId } = useBranch();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [pricingHistory, setPricingHistory] = useState<PricingHistory[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    supplier_type: "feed",
    notes: "",
  });

  const [priceFormData, setPriceFormData] = useState({
    product_name: "",
    price_per_unit: "",
    unit: "bag",
    notes: "",
  });

  useEffect(() => {
    fetchSuppliers();
  }, [currentBranchId]);

  const fetchSuppliers = async () => {
    let query = supabase.from("suppliers").select("*").order("name");
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data } = await query;
    setSuppliers(data || []);
  };

  const fetchPricingHistory = async (supplierId: string) => {
    const { data } = await supabase
      .from("supplier_pricing_history")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("effective_date", { ascending: false });
    setPricingHistory(data || []);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("suppliers").insert({
      ...formData,
      branch_id: currentBranchId,
    });

    if (error) {
      toast.error("Failed to add supplier");
      console.error(error);
    } else {
      toast.success("Supplier added successfully");
      setAddDialogOpen(false);
      resetForm();
      fetchSuppliers();
    }
    setLoading(false);
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setLoading(true);

    const { error } = await supabase
      .from("suppliers")
      .update(formData)
      .eq("id", selectedSupplier.id);

    if (error) {
      toast.error("Failed to update supplier");
      console.error(error);
    } else {
      toast.success("Supplier updated successfully");
      setEditDialogOpen(false);
      resetForm();
      fetchSuppliers();
    }
    setLoading(false);
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      // Check for foreign key constraint violation
      // Usually means they have existing purchases or pricing history
      if (error.code === '23503' || error.message?.includes('violates foreign key constraint') || error.message?.includes('linked')) {
        toast.error(`Cannot delete ${name} because they have existing history records or purchases. You must delete those first.`);
      } else {
        toast.error(`Failed to delete ${name}.`);
      }
    } else {
      toast.success(`${name} deleted successfully`);
      if (selectedSupplier?.id === id) {
        setSelectedSupplier(null);
        setPricingHistory([]);
      }
      fetchSuppliers();
    }
    setLoading(false);
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setLoading(true);

    const { error } = await supabase.from("supplier_pricing_history").insert({
      supplier_id: selectedSupplier.id,
      product_name: priceFormData.product_name,
      price_per_unit: parseFloat(priceFormData.price_per_unit),
      unit: priceFormData.unit,
      notes: priceFormData.notes || null,
    });

    if (error) {
      toast.error("Failed to add pricing record");
      console.error(error);
    } else {
      toast.success("Pricing record added");
      setPriceDialogOpen(false);
      setPriceFormData({ product_name: "", price_per_unit: "", unit: "bag", notes: "" });
      fetchPricingHistory(selectedSupplier.id);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", address: "", supplier_type: "feed", notes: "" });
    setSelectedSupplier(null);
  };

  const openEditDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      supplier_type: supplier.supplier_type,
      notes: supplier.notes || "",
    });
    setEditDialogOpen(true);
  };

  const viewPricingHistory = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    fetchPricingHistory(supplier.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Supplier Management</h2>
          <p className="text-muted-foreground">Track vendors, contacts, and pricing history</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
              <DialogDescription>Add a new vendor for feed or other supplies</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Ade Feeds Nigeria"
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
                    value={formData.supplier_type}
                    onValueChange={(v) => setFormData({ ...formData, supplier_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">Feed Supplier</SelectItem>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
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
                  placeholder="supplier@email.com"
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
                {loading ? "Adding..." : "Add Supplier"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suppliers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Suppliers ({suppliers.length})
            </CardTitle>
            <CardDescription>Click on a supplier to view pricing history</CardDescription>
          </CardHeader>
          <CardContent>
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No suppliers added yet. Add your first supplier above.
              </p>
            ) : (
              <div className="space-y-3">
                {suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedSupplier?.id === supplier.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                      }`}
                    onClick={() => viewPricingHistory(supplier)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{supplier.name}</p>
                          <Badge variant={supplier.is_active ? "default" : "secondary"}>
                            {supplier.supplier_type}
                          </Badge>
                        </div>
                        {supplier.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </p>
                        )}
                        {supplier.email && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </p>
                        )}
                        {supplier.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {supplier.address}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(supplier);
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
                            handleDeleteSupplier(supplier.id, supplier.name);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing History */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Pricing History
                </CardTitle>
                <CardDescription>
                  {selectedSupplier ? `For ${selectedSupplier.name}` : "Select a supplier to view history"}
                </CardDescription>
              </div>
              {selectedSupplier && (
                <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Price
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Pricing Record</DialogTitle>
                      <DialogDescription>Record a price from {selectedSupplier.name}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPrice} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Product Name *</Label>
                        <Input
                          value={priceFormData.product_name}
                          onChange={(e) => setPriceFormData({ ...priceFormData, product_name: e.target.value })}
                          placeholder="e.g., Layer Feed"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Price per Unit *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={priceFormData.price_per_unit}
                            onChange={(e) => setPriceFormData({ ...priceFormData, price_per_unit: e.target.value })}
                            placeholder="16500"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit</Label>
                          <Select
                            value={priceFormData.unit}
                            onValueChange={(v) => setPriceFormData({ ...priceFormData, unit: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bag">Bag</SelectItem>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="unit">Unit</SelectItem>
                              <SelectItem value="box">Box</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={priceFormData.notes}
                          onChange={(e) => setPriceFormData({ ...priceFormData, notes: e.target.value })}
                          placeholder="Any notes about this price..."
                          rows={2}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Adding..." : "Add Price Record"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedSupplier ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a supplier to view their pricing history</p>
              </div>
            ) : pricingHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No pricing history recorded yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingHistory.map((price) => (
                    <TableRow key={price.id}>
                      <TableCell className="text-sm">
                        {new Date(price.effective_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{price.product_name}</TableCell>
                      <TableCell className="text-right">
                        ₦{Number(price.price_per_unit).toLocaleString()}/{price.unit}
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
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSupplier} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Supplier Name *</Label>
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
                  value={formData.supplier_type}
                  onValueChange={(v) => setFormData({ ...formData, supplier_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feed">Feed Supplier</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
              {loading ? "Updating..." : "Update Supplier"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuppliersTab;
