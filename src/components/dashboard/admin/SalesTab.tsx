import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";

const SalesTab = () => {
  const { currentBranchId } = useBranch();
  const [sales, setSales] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);

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
      setTotalSales(total);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Sales Records</h2>
        <p className="text-muted-foreground">Track all sales transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium">Average Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₦{sales.length > 0 ? Math.round(totalSales / sales.length).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">per sale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{sales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">in last 30 days</p>
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
                <TableHead>Buyer</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                    <TableCell>{record.buyer_name || "-"}</TableCell>
                    <TableCell>{record.profiles?.name || "Unknown"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesTab;
