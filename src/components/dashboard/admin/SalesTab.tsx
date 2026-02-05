import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";
import { BarChart3, CreditCard } from "lucide-react";
import UpdatePaymentDialog from "./dialogs/UpdatePaymentDialog";

const SalesTab = () => {
  const navigate = useNavigate();
  const { currentBranchId } = useBranch();
  const [sales, setSales] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let query = supabase
      .from("sales_records")
      .select("*, profiles(name)")
      .order("date", { ascending: false })
      .limit(30);

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data } = await query;

    if (data) {
      setSales(data);
      const total = data.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      const paid = data.reduce((acc, curr) => acc + Number(curr.amount_paid || 0), 0);
      setTotalSales(total);
      setTotalPaid(paid);
      setTotalPending(total - paid);
    }
  };

  const getPaymentBadge = (status: string, amountPaid: number, totalAmount: number) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Paid</Badge>;
      case 'partial':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sales Records</h2>
          <p className="text-muted-foreground">Track all sales transactions</p>
        </div>
        <Button onClick={() => navigate("/analytics")} variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          View Analytics
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sales (Last 30 Days)</CardTitle>
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
            <div className="text-2xl font-bold text-green-600">₦{totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">received payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">₦{totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">outstanding balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₦{sales.length > 0 ? Math.round(totalSales / sales.length).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">per sale</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
          <CardDescription>Last 30 days of sales data</CardDescription>
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
                <TableHead>Buyer</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No sales records yet
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((record) => (
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
                    <TableCell>{record.buyer_name || "-"}</TableCell>
                    <TableCell>{record.profiles?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleUpdatePayment(record)}
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UpdatePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        sale={selectedSale}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default SalesTab;
