import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";
import { BarChart3, CreditCard, Truck, Package, Eye } from "lucide-react";
import UpdatePaymentDialog from "./dialogs/UpdatePaymentDialog";
import PendingPaymentsDialog from "./dialogs/PendingPaymentsDialog";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 15;

const SalesTab = () => {
  const navigate = useNavigate();
  const { currentBranchId } = useBranch();
  const [sales, setSales] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [preorderCount, setPreorderCount] = useState(0);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'preorder' | 'delivered'>('all');

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let query = supabase
      .from("sales_records")
      .select("*, profiles(name), customers(name)")
      .order("date", { ascending: false });

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data } = await query;

    if (data) {
      setSales(data);
      const total = data.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      const paid = data.reduce((acc, curr) => acc + Number(curr.amount_paid || 0), 0);
      const preorders = data.filter((s) => s.delivery_status === 'preorder').length;
      setTotalSales(total);
      setTotalPaid(paid);
      setTotalPending(total - paid);
      setPreorderCount(preorders);
    }
  };

  const filteredSales = sales.filter((s) => {
    if (deliveryFilter === 'all') return true;
    return s.delivery_status === deliveryFilter;
  });

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: filteredSales.length,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  const paginatedSales = filteredSales.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  const getPaymentBadge = (status: string, amountPaid: number, totalAmount: number) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Paid</Badge>;
      case 'partial':
        return (
          <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">
            Partial (₦{Number(totalAmount - amountPaid).toLocaleString()} left)
          </Badge>
        );
      default:
        return <Badge variant="destructive">Pending</Badge>;
    }
  };

  const handleUpdatePayment = (sale: any) => {
    setSelectedSale(sale);
    setPaymentDialogOpen(true);
  };

  const handleMarkDelivered = async (saleId: string) => {
    const { error } = await supabase
      .from("sales_records")
      .update({ delivery_status: 'delivered' })
      .eq("id", saleId);

    if (error) {
      toast.error("Failed to update delivery status");
    } else {
      toast.success("Marked as delivered");
      fetchData();
    }
  };

  const getDeliveryBadge = (status: string) => {
    if (status === 'preorder') {
      return <Badge className="bg-accent text-accent-foreground hover:bg-accent/80"><Package className="h-3 w-3 mr-1" />Preorder</Badge>;
    }
    return <Badge className="bg-primary/10 text-primary hover:bg-primary/20"><Truck className="h-3 w-3 mr-1" />Delivered</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sales Records</h2>
          <p className="text-muted-foreground">Track all sales transactions ({sales.length} total)</p>
        </div>
        <Button onClick={() => navigate("/analytics")} variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          View Analytics
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">from {sales.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₦{totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">received payments</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPendingDialogOpen(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Pending Payments
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">₦{totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Pickup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-foreground">{preorderCount}</div>
            <p className="text-xs text-muted-foreground mt-1">preorders awaiting delivery</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sales History</CardTitle>
            <CardDescription>Showing {paginatedSales.length} of {filteredSales.length} records</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={deliveryFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setDeliveryFilter('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={deliveryFilter === 'preorder' ? 'default' : 'outline'}
              onClick={() => setDeliveryFilter('preorder')}
            >
              <Package className="h-3 w-3 mr-1" />
              Preorders
            </Button>
            <Button
              size="sm"
              variant={deliveryFilter === 'delivered' ? 'default' : 'outline'}
              onClick={() => setDeliveryFilter('delivered')}
            >
              <Truck className="h-3 w-3 mr-1" />
              Delivered
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Delivery Status</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No sales records found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSales.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.product_name}</p>
                        <p className="text-xs text-muted-foreground">{record.product_type}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.quantity} {record.unit}
                    </TableCell>
                    <TableCell>₦{Number(record.price_per_unit).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">₦{Number(record.total_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      {getPaymentBadge(record.payment_status, record.amount_paid, record.total_amount)}
                    </TableCell>
                    <TableCell>
                      {getDeliveryBadge(record.delivery_status)}
                    </TableCell>
                    <TableCell>{record.customers?.name || record.buyer_name || "-"}</TableCell>
                    <TableCell>{record.profiles?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleUpdatePayment(record)}
                          title="Update payment"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        {record.delivery_status === 'preorder' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleMarkDelivered(record.id)}
                            title="Mark as delivered"
                          >
                            <Truck className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            getPageNumbers={getPageNumbers}
          />
        </CardContent>
      </Card>

      <UpdatePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        sale={selectedSale}
        onSuccess={fetchData}
      />

      <PendingPaymentsDialog
        open={pendingDialogOpen}
        onOpenChange={setPendingDialogOpen}
        branchId={currentBranchId}
        onUpdate={fetchData}
      />
    </div>
  );
};

export default SalesTab;
