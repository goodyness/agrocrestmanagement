import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Package } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { differenceInDays, format } from "date-fns";

interface ExpiryItem {
  id: string;
  feedName: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

const InventoryExpiryTracker = () => {
  const { currentBranchId } = useBranch();
  const [items, setItems] = useState<ExpiryItem[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let query = supabase
      .from("feed_purchases")
      .select("id, quantity, unit, expiry_date, feed_types(feed_name)")
      .not("expiry_date", "is", null)
      .order("expiry_date", { ascending: true });
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data } = await query;

    if (!data) return;

    const today = new Date();
    const mapped: ExpiryItem[] = data.map((p: any) => ({
      id: p.id,
      feedName: p.feed_types?.feed_name || "Unknown",
      quantity: p.quantity,
      unit: p.unit,
      expiryDate: p.expiry_date,
      daysUntilExpiry: differenceInDays(new Date(p.expiry_date), today),
    }));

    setItems(mapped.filter((i) => i.daysUntilExpiry <= 60));
  };

  const getStatusBadge = (days: number) => {
    if (days < 0) return <Badge className="bg-destructive/20 text-destructive">Expired</Badge>;
    if (days <= 7) return <Badge className="bg-destructive/20 text-destructive">Expiring Soon</Badge>;
    if (days <= 30) return <Badge className="bg-warning/20 text-warning">Expiring</Badge>;
    return <Badge variant="outline">OK</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-5 w-5 text-warning" />
          Inventory Expiry Tracking
        </CardTitle>
        <CardDescription>Feed & medicine items expiring within 60 days</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No items expiring soon. Set expiry dates when recording feed purchases.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.feedName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit} • Expires {format(new Date(item.expiryDate), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.daysUntilExpiry < 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {getStatusBadge(item.daysUntilExpiry)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryExpiryTracker;
