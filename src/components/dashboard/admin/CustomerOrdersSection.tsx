import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Check, Truck, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

interface Order {
  id: string;
  customer_id: string;
  customer_name?: string;
  order_items: any[];
  total_amount: number;
  status: string;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
}

const CustomerOrdersSection = () => {
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [currentBranchId, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase
      .from("customer_orders")
      .select("*, customers(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data } = await query;
    const mapped = (data || []).map((o: any) => ({
      ...o,
      customer_name: o.customers?.name || "Unknown",
    }));
    setOrders(mapped);
    setLoading(false);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("customer_orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) {
      toast.error("Failed to update order");
    } else {
      toast.success(`Order marked as ${newStatus}`);
      fetchOrders();
    }
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
    <Card className="shadow-md mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Customer Orders
            </CardTitle>
            <CardDescription>Manage incoming customer orders</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.customer_name}</TableCell>
                    <TableCell className="text-sm">
                      {Array.isArray(order.order_items) ? order.order_items.map((item: any, i: number) => (
                        <div key={i} className="text-xs">{item.product} × {item.quantity}</div>
                      )) : "—"}
                    </TableCell>
                    <TableCell className="font-semibold">₦{Number(order.total_amount).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {order.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, "confirmed")} title="Confirm">
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        {order.status === "confirmed" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, "delivered")} title="Mark Delivered">
                            <Truck className="h-3 w-3" />
                          </Button>
                        )}
                        {(order.status === "pending" || order.status === "confirmed") && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(order.id, "cancelled")} title="Cancel">
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerOrdersSection;
