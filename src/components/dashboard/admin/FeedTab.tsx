import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Package, TrendingDown, ShoppingCart, Warehouse, History, PackageOpen } from "lucide-react";
import AddFeedTypeDialog from "./dialogs/AddFeedTypeDialog";
import AddFeedPurchaseDialog from "./dialogs/AddFeedPurchaseDialog";
import EditFeedTypeDialog from "./dialogs/EditFeedTypeDialog";
import LowStockAlertDialog from "./dialogs/LowStockAlertDialog";
import FeedConsumptionHistory from "./FeedConsumptionHistory";
import { useBranch } from "@/contexts/BranchContext";

const ITEMS_PER_PAGE = 10;

const FeedTab = () => {
  const { currentBranchId } = useBranch();
  const [feedTypes, setFeedTypes] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [totalPurchased, setTotalPurchased] = useState<Record<string, { quantity: number; unit: string }>>({});
  const [totalConsumed, setTotalConsumed] = useState<Record<string, { quantity: number; unit: string }>>({});

  // Filter States
  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<string>("all");

  // Calculator States
  const [purchaseStats, setPurchaseStats] = useState({ totalBags: 0, totalCost: 0, show: false });

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let typesQuery = supabase.from("feed_types").select("*").order("created_at", { ascending: false });
    if (currentBranchId) typesQuery = typesQuery.eq("branch_id", currentBranchId);
    const { data: typesData } = await typesQuery;

    let inventoryQuery = supabase.from("feed_inventory").select("*, feed_types(feed_name, unit_type, price_per_unit)").order("updated_at", { ascending: false });
    if (currentBranchId) inventoryQuery = inventoryQuery.eq("branch_id", currentBranchId);
    const { data: inventoryData } = await inventoryQuery;

    // Fetch ALL purchases (not limited) to calculate total purchased
    let allPurchasesQuery = supabase.from("feed_purchases").select("feed_type_id, quantity, unit");
    if (currentBranchId) allPurchasesQuery = allPurchasesQuery.eq("branch_id", currentBranchId);
    const { data: allPurchasesData } = await allPurchasesQuery;

    // Fetch ALL consumption to calculate total used
    let allConsumptionQuery = supabase.from("feed_consumption").select("feed_type_id, quantity_used, unit");
    if (currentBranchId) allConsumptionQuery = allConsumptionQuery.eq("branch_id", currentBranchId);
    const { data: allConsumptionData } = await allConsumptionQuery;

    // Calculate total purchased per feed type (convert all to bags)
    const purchaseTotals: Record<string, { quantity: number; unit: string }> = {};
    allPurchasesData?.forEach((p) => {
      if (!purchaseTotals[p.feed_type_id]) {
        purchaseTotals[p.feed_type_id] = { quantity: 0, unit: "bag" };
      }
      // Convert to bags (1 bag = 25kg)
      let qty = p.quantity;
      if (p.unit === "kg") {
        qty = p.quantity / 25;
      }
      purchaseTotals[p.feed_type_id].quantity += qty;
    });
    setTotalPurchased(purchaseTotals);

    // Calculate total consumed per feed type (convert all to bags)
    const consumptionTotals: Record<string, { quantity: number; unit: string }> = {};
    allConsumptionData?.forEach((c) => {
      if (!consumptionTotals[c.feed_type_id]) {
        consumptionTotals[c.feed_type_id] = { quantity: 0, unit: "bag" };
      }
      // Convert to bags (1 bag = 25kg)
      let qty = c.quantity_used;
      if (c.unit === "kg") {
        qty = c.quantity_used / 25;
      }
      consumptionTotals[c.feed_type_id].quantity += qty;
    });
    setTotalConsumed(consumptionTotals);

    let purchasesQuery = supabase.from("feed_purchases").select("*, feed_types(feed_name), profiles(name)").order("date", { ascending: false });
    if (currentBranchId) purchasesQuery = purchasesQuery.eq("branch_id", currentBranchId);
    const { data: purchasesData } = await purchasesQuery;

    let alertsQuery = supabase.from("low_stock_alerts").select("*, feed_types(feed_name)").eq("is_active", true);
    if (currentBranchId) alertsQuery = alertsQuery.eq("branch_id", currentBranchId);
    const { data: alertsData } = await alertsQuery;

    setFeedTypes(typesData || []);
    setInventory(inventoryData || []);
    setPurchases(purchasesData || []);
    setAlerts(alertsData || []);
  };

  useEffect(() => {
    let result = purchases;

    // Date range filter
    if (date?.from) {
      const fromD = startOfDay(date.from);
      const toD = date.to ? endOfDay(date.to) : endOfDay(date.from);

      result = result.filter((record) => {
        const recordDate = new Date(record.date);
        return isWithinInterval(recordDate, { start: fromD, end: toD });
      });
    }

    // Feed type filter
    if (selectedProduct !== "all") {
      result = result.filter((p) => p.feed_type_id === selectedProduct);
    }

    setFilteredPurchases(result);

    // Calculate totals based on currently filtered results
    let totalBags = 0;
    let totalCost = 0;

    result.forEach(purchase => {
      const qty = Number(purchase.quantity || 0);
      const unit = purchase.unit?.toLowerCase() || '';

      // Convert to bags
      if (unit === 'kg') {
        totalBags += qty / 25;
      } else {
        totalBags += qty; // Assuming 'bag' or similar
      }

      totalCost += Number(purchase.total_cost || 0);
    });

    setPurchaseStats({
      totalBags,
      totalCost,
      show: result.length > 0
    });

  }, [purchases, date, selectedProduct]);

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: filteredPurchases.length,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  const paginatedPurchases = filteredPurchases.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  // Check for low stock items
  const getLowStockItems = () => {
    return alerts.filter(alert => {
      const inv = inventory.find(i => i.feed_type_id === alert.feed_type_id);
      return inv && inv.quantity_in_stock <= alert.threshold_quantity;
    });
  };

  const lowStockItems = getLowStockItems();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Feed Management</h2>
          <p className="text-muted-foreground">Manage feed types, purchases, and inventory</p>
        </div>
        <LowStockAlertDialog feedTypes={feedTypes} onSuccess={fetchData} branchId={currentBranchId} />
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Consumption History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6">
          {lowStockItems.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h4 className="font-semibold text-destructive">Low Stock Alert</h4>
                <p className="text-sm text-muted-foreground">
                  {lowStockItems.map(a => a.feed_types?.feed_name).join(", ")} running low. Consider restocking soon.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feed Types Card */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Feed Types</CardTitle>
                    <CardDescription>Define types of feed and pricing</CardDescription>
                  </div>
                  <AddFeedTypeDialog onSuccess={fetchData} branchId={currentBranchId} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {feedTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No feed types added yet</p>
                  ) : (
                    feedTypes.map((type) => (
                      <div key={type.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{type.feed_name}</p>
                            <p className="text-sm text-muted-foreground">Unit: {type.unit_type}</p>
                            <p className="text-sm font-medium text-primary mt-1">
                              ₦{Number(type.price_per_unit).toLocaleString()}/{type.unit_type}
                            </p>
                          </div>
                          <EditFeedTypeDialog feedType={type} onSuccess={fetchData} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current Inventory Card */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Current Inventory
                    </CardTitle>
                    <CardDescription>Available feed stock levels</CardDescription>
                  </div>
                  <AddFeedPurchaseDialog feedTypes={feedTypes} onSuccess={fetchData} branchId={currentBranchId} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {feedTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No feed types added yet. Add a feed type first.</p>
                  ) : (
                    feedTypes.map((feedType) => {
                      const alert = alerts.find(a => a.feed_type_id === feedType.id);
                      const purchased = totalPurchased[feedType.id];
                      const consumed = totalConsumed[feedType.id];

                      // Calculate Available = Bought - Used (all in bags)
                      const boughtBags = purchased?.quantity || 0;
                      const usedBags = consumed?.quantity || 0;
                      const availableBags = Math.max(0, boughtBags - usedBags);

                      // Check low stock based on available bags
                      const isLowStock = alert && availableBags <= (alert.threshold_unit === 'kg' ? alert.threshold_quantity / 25 : alert.threshold_quantity);

                      return (
                        <div key={feedType.id} className={`p-4 rounded-lg ${isLowStock ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/50'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-lg">{feedType.feed_name}</p>
                              {isLowStock && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <TrendingDown className="h-3 w-3" />
                                  Low
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            {/* Total Bought */}
                            <div className="text-center p-2 bg-background rounded-md">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <ShoppingCart className="h-3 w-3" />
                                Bought
                              </div>
                              <p className="text-sm font-bold text-primary">
                                {boughtBags.toFixed(1)} bags
                              </p>
                            </div>

                            {/* Total Used */}
                            <div className="text-center p-2 bg-background rounded-md">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <PackageOpen className="h-3 w-3" />
                                Used
                              </div>
                              <p className="text-sm font-bold text-muted-foreground">
                                {usedBags.toFixed(1)} bags
                              </p>
                            </div>

                            {/* Available = Bought - Used */}
                            <div className="text-center p-2 bg-background rounded-md">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <Warehouse className="h-3 w-3" />
                                Available
                              </div>
                              <p className={`text-sm font-bold ${isLowStock ? 'text-destructive' : 'text-primary'}`}>
                                {availableBags.toFixed(1)} bags
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2 text-right">
                            {availableBags > 0 ? `≈ ${(availableBags * 25).toFixed(0)} kg remaining` : 'Out of stock'}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Purchase History Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>Purchase History</CardTitle>
                  <CardDescription>Feed purchase records ({filteredPurchases.length} filtered)</CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Feed Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Feed Types</SelectItem>
                      {feedTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.feed_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

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
                </div>
              </div>
            </CardHeader>

            {purchaseStats.show && (
              <div className="px-6 pb-2">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-full">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary">Purchase Calculator</h4>
                      <p className="text-sm text-primary/80">Total for selected period/feed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 text-right">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Quantity</p>
                      <p className="text-xl font-bold text-foreground">{purchaseStats.totalBags.toFixed(1)} Bags</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
                      <p className="text-xl font-bold text-primary">₦{purchaseStats.totalCost.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <CardContent>
              {paginatedPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No purchase records found.</p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Feed Type</th>
                          <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Quantity</th>
                          <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Price/Unit</th>
                          <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Total Cost</th>
                          <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Purchased By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPurchases.map((purchase) => (
                          <tr key={purchase.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-3 px-3 text-sm">{format(new Date(purchase.date), "MMM dd, yyyy")}</td>
                            <td className="py-3 px-3 text-sm font-medium">{purchase.feed_types?.feed_name}</td>
                            <td className="py-3 px-3 text-sm text-right font-medium">{purchase.quantity} {purchase.unit}</td>
                            <td className="py-3 px-3 text-sm text-right">₦{Number(purchase.price_per_unit).toLocaleString()}</td>
                            <td className="py-3 px-3 text-sm text-right font-semibold text-primary">₦{Number(purchase.total_cost).toLocaleString()}</td>
                            <td className="py-3 px-3 text-sm text-muted-foreground">{purchase.profiles?.name || 'Unknown'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    getPageNumbers={getPageNumbers}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <FeedConsumptionHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedTab;
