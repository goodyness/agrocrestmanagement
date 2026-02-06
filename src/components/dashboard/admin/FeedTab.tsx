import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Package, TrendingDown, ShoppingCart, Warehouse, History, PackageOpen } from "lucide-react";
import AddFeedTypeDialog from "./dialogs/AddFeedTypeDialog";
import AddFeedPurchaseDialog from "./dialogs/AddFeedPurchaseDialog";
import EditFeedTypeDialog from "./dialogs/EditFeedTypeDialog";
import LowStockAlertDialog from "./dialogs/LowStockAlertDialog";
import FeedConsumptionHistory from "./FeedConsumptionHistory";
import { useBranch } from "@/contexts/BranchContext";

const FeedTab = () => {
  const { currentBranchId } = useBranch();
  const [feedTypes, setFeedTypes] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [totalPurchased, setTotalPurchased] = useState<Record<string, { quantity: number; unit: string }>>({});
  const [totalConsumed, setTotalConsumed] = useState<Record<string, { quantity: number; unit: string }>>({});

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

    let purchasesQuery = supabase.from("feed_purchases").select("*, feed_types(feed_name), profiles(name)").order("created_at", { ascending: false }).limit(10);
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
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inventory records yet</p>
              ) : (
                inventory.map((item) => {
                  const alert = alerts.find(a => a.feed_type_id === item.feed_type_id);
                  const isLowStock = alert && item.quantity_in_stock <= alert.threshold_quantity;
                  const purchased = totalPurchased[item.feed_type_id];
                  const consumed = totalConsumed[item.feed_type_id];
                  
                  return (
                    <div key={item.id} className={`p-4 rounded-lg ${isLowStock ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/50'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground text-lg">{item.feed_types?.feed_name}</p>
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
                            {purchased ? `${purchased.quantity.toFixed(1)}` : '0'} bags
                          </p>
                        </div>
                        
                        {/* Total Used */}
                        <div className="text-center p-2 bg-background rounded-md">
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                            <PackageOpen className="h-3 w-3" />
                            Used
                          </div>
                          <p className="text-sm font-bold text-muted-foreground">
                            {consumed ? `${consumed.quantity.toFixed(1)}` : '0'} bags
                          </p>
                        </div>
                        
                        {/* Available */}
                        <div className="text-center p-2 bg-background rounded-md">
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                            <Warehouse className="h-3 w-3" />
                            Available
                          </div>
                          <p className={`text-sm font-bold ${isLowStock ? 'text-destructive' : 'text-primary'}`}>
                            {Number(item.quantity_in_stock).toFixed(1)} {item.unit}
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2 text-right">
                        Last updated: {new Date(item.updated_at).toLocaleDateString()}
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
          <CardTitle>Recent Purchases</CardTitle>
          <CardDescription>Feed purchase history with pricing</CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No purchase records yet. Add your first feed purchase above.</p>
          ) : (
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
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b last:border-0">
                      <td className="py-3 px-3 text-sm">{new Date(purchase.date).toLocaleDateString()}</td>
                      <td className="py-3 px-3 text-sm font-medium">{purchase.feed_types?.feed_name}</td>
                      <td className="py-3 px-3 text-sm text-right">{purchase.quantity} {purchase.unit}</td>
                      <td className="py-3 px-3 text-sm text-right">₦{Number(purchase.price_per_unit).toLocaleString()}</td>
                      <td className="py-3 px-3 text-sm text-right font-semibold text-primary">₦{Number(purchase.total_cost).toLocaleString()}</td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">{purchase.profiles?.name || 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
