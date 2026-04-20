import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";
import { BarChart3, CreditCard, Truck, Package, Eye, Calendar as CalendarIcon, X } from "lucide-react";
import UpdatePaymentDialog from "./dialogs/UpdatePaymentDialog";
import PendingPaymentsDialog from "./dialogs/PendingPaymentsDialog";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import AddSalesDialog from "@/components/dashboard/worker/AddSalesDialog";

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

  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [productQuantityStats, setProductQuantityStats] = useState({ crates: 0, pieces: 0, show: false });

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
      // Extract unique product names for the filter dropdown
      const uniqueProducts = Array.from(new Set(data.map(s => s.product_name || s.product_type))).filter(Boolean) as string[];
      setAvailableProducts(uniqueProducts);
    }
  };

  useEffect(() => {
    let result = sales;

    // Delivery filter
    if (deliveryFilter !== 'all') {
      result = result.filter((s) => s.delivery_status === deliveryFilter);
    }

    // Date range filter
    if (date?.from) {
      const fromD = startOfDay(date.from);
      const toD = date.to ? endOfDay(date.to) : endOfDay(date.from);

      result = result.filter((record) => {
        const recordDate = new Date(record.date);
        return isWithinInterval(recordDate, { start: fromD, end: toD });
      });
    }

    // Product filter
    if (selectedProduct !== "all") {
      result = result.filter((s) => (s.product_name === selectedProduct || s.product_type === selectedProduct));
    }

    setFilteredSales(result);

    // Calculate totals for currently filtered data
    const total = result.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
    const paid = result.reduce((acc, curr) => acc + Number(curr.amount_paid || 0), 0);
    const preorders = result.filter((s) => s.delivery_status === 'preorder').length;

    setTotalSales(total);
    setTotalPaid(paid);
    setTotalPending(total - paid);
    setPreorderCount(preorders);

    // Calculate specific product quantities based on currently filtered results
    let totalPieces = 0;
    let totalCrates = 0;

    result.forEach(sale => {
      const qty = Number(sale.quantity || 0);
      const unit = sale.unit?.toLowerCase() || '';

      if (unit.includes('piece')) {
        totalPieces += qty;
      } else if (unit.includes('crate')) {
        totalCrates += qty;
      } else {
        // If unit is unknown or missing, try to infer or just add as pieces for now
        totalPieces += qty;
      }
    });

    // Normalize pieces to crates (assuming 30 pieces = 1 crate based on other parts of app)
    if (totalPieces >= 30) {
      totalCrates += Math.floor(totalPieces / 30);
      totalPieces = totalPieces % 30;
    }

    // Always show if there are any results matching the filter
    setProductQuantityStats({
      crates: totalCrates,
      pieces: totalPieces,
      show: result.length > 0
    });

  }, [sales, deliveryFilter, date, selectedProduct]);

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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sales Records</h2>
          <p className="text-muted-foreground">Track all sales transactions ({filteredSales.length} filtered)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {availableProducts.length > 0 && (
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {availableProducts.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[260px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Filter by date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {date?.from && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDate(undefined)}
                title="Clear date filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="w-[180px]">
            <AddSalesDialog onSuccess={fetchData} />
          </div>

          <Button onClick={() => navigate("/analytics")} variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </div>
      </div>

      {/* Dynamic Quantity Calculator Card */}
      {productQuantityStats.show && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quantity Calculator ({selectedProduct})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {productQuantityStats.crates} Crates {productQuantityStats.pieces > 0 && `, ${productQuantityStats.pieces} Pieces`}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Total {selectedProduct} sold between {date?.from ? format(date.from, "MMM dd") : ""} and {date?.to ? format(date.to, "MMM dd, yyyy") : date?.from ? format(date.from, "MMM dd, yyyy") : ""}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">from {filteredSales.length} transactions</p>
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
