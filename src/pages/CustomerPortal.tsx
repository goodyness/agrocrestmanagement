import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sprout, ShoppingCart, Package, Truck, Phone, Loader2, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface StockItem {
  product: string;
  available: number;
  unit: string;
  price: number;
}

interface OrderItem {
  product: string;
  quantity: number;
  unit: string;
  price: number;
}

const CustomerPortal = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    // Show available products based on recent sales patterns
    const { data: recentSales } = await supabase
      .from("sales_records")
      .select("product_name, product_type, price_per_unit, unit")
      .order("date", { ascending: false })
      .limit(100);

    const productMap: Record<string, StockItem> = {};
    (recentSales || []).forEach(s => {
      if (!productMap[s.product_name]) {
        productMap[s.product_name] = {
          product: s.product_name,
          available: 0,
          unit: s.unit,
          price: Number(s.price_per_unit),
        };
      }
    });

    setStockItems(Object.values(productMap));
  };

  const lookupCustomer = async () => {
    if (!phone.trim()) {
      toast.error("Enter your phone number");
      return;
    }
    setLookupLoading(true);

    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("phone", phone.trim())
      .maybeSingle();

    if (data) {
      setCustomerId(data.id);
      setCustomerName(data.name);
      fetchCustomerOrders(data.id);
      toast.success(`Welcome back, ${data.name}!`);
    } else {
      toast.error("No account found with this phone number. Contact the farm to register.");
    }
    setLookupLoading(false);
  };

  const fetchCustomerOrders = async (cid: string) => {
    const { data } = await supabase
      .from("customer_orders")
      .select("*")
      .eq("customer_id", cid)
      .order("created_at", { ascending: false })
      .limit(20);
    setOrders(data || []);
  };

  const addToOrder = (item: StockItem) => {
    const existing = orderItems.find(o => o.product === item.product);
    if (existing) {
      setOrderItems(orderItems.map(o =>
        o.product === item.product ? { ...o, quantity: o.quantity + 1 } : o
      ));
    } else {
      setOrderItems([...orderItems, { product: item.product, quantity: 1, unit: item.unit, price: item.price }]);
    }
  };

  const removeFromOrder = (product: string) => {
    setOrderItems(orderItems.filter(o => o.product !== product));
  };

  const totalAmount = orderItems.reduce((s, i) => s + i.quantity * i.price, 0);

  const placeOrder = async () => {
    if (!customerId || orderItems.length === 0) return;
    setLoading(true);

    const { error } = await supabase.from("customer_orders").insert({
      customer_id: customerId,
      order_items: orderItems.map(i => ({ product: i.product, quantity: i.quantity, unit: i.unit, price: i.price })),
      total_amount: totalAmount,
      delivery_date: deliveryDate || null,
      notes: notes || null,
      status: "pending",
    });

    if (error) {
      toast.error("Failed to place order");
    } else {
      toast.success("Order placed successfully! The farm will confirm shortly.");
      setOrderItems([]);
      setNotes("");
      setDeliveryDate("");
      setOrderDialogOpen(false);
      fetchCustomerOrders(customerId);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "confirmed": return <Badge className="bg-blue-500 text-white">Confirmed</Badge>;
      case "delivered": return <Badge className="bg-green-600 text-white">Delivered</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/95 backdrop-blur sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sprout className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Agrocrest Farm</h1>
                <p className="text-xs text-muted-foreground">Customer Portal</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Login */}
        {!customerId ? (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Customer Login
              </CardTitle>
              <CardDescription>Enter your registered phone number to access your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08012345678"
                  onKeyDown={(e) => e.key === "Enter" && lookupCustomer()}
                />
              </div>
              <Button className="w-full" onClick={lookupCustomer} disabled={lookupLoading}>
                {lookupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {lookupLoading ? "Looking up..." : "Find My Account"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Welcome */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Welcome, {customerName}!</h2>
                <p className="text-muted-foreground">Browse products and place orders</p>
              </div>
              <Button variant="outline" onClick={() => { setCustomerId(null); setCustomerName(""); setOrders([]); }}>
                Logout
              </Button>
            </div>

            {/* Available Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Available Products
                </CardTitle>
                <CardDescription>Browse and add items to your order</CardDescription>
              </CardHeader>
              <CardContent>
                {stockItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No products available currently</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {stockItems.map((item) => (
                      <div key={item.product} className="border rounded-lg p-4 flex flex-col justify-between">
                        <div>
                          <p className="font-semibold">{item.product}</p>
                          <p className="text-sm text-muted-foreground">₦{item.price.toLocaleString()} / {item.unit}</p>
                        </div>
                        <Button size="sm" className="mt-3 w-full" onClick={() => addToOrder(item)}>
                          <ShoppingCart className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cart */}
            {orderItems.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Your Cart ({orderItems.length} items)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.product} className="flex items-center justify-between p-2 bg-background rounded border">
                      <div>
                        <p className="font-medium text-sm">{item.product}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × ₦{item.price.toLocaleString()} = ₦{(item.quantity * item.price).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 1;
                            setOrderItems(orderItems.map(o => o.product === item.product ? { ...o, quantity: qty } : o));
                          }}
                          className="w-16 h-8 text-center"
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeFromOrder(item.product)}>×</Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="font-bold text-lg">Total: ₦{totalAmount.toLocaleString()}</span>
                    <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>Place Order</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm Order</DialogTitle>
                          <DialogDescription>Review and submit your order</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Preferred Delivery Date</Label>
                            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Notes (optional)</Label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requests..." rows={2} />
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="font-bold">Total: ₦{totalAmount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{orderItems.length} item(s)</p>
                          </div>
                          <Button className="w-full" onClick={placeOrder} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                            {loading ? "Placing..." : "Confirm Order"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Your Orders
                </CardTitle>
                <CardDescription>Track your order status</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No orders yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm">
                              {Array.isArray(order.order_items) ? order.order_items.map((item: any, i: number) => (
                                <div key={i} className="text-xs">{item.product} × {item.quantity}</div>
                              )) : "—"}
                            </TableCell>
                            <TableCell className="font-semibold">₦{Number(order.total_amount).toLocaleString()}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default CustomerPortal;
