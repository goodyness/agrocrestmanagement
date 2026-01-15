import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBranch } from "@/contexts/BranchContext";

interface FeedConsumptionData {
  date: string;
  totalUsed: number;
  cost: number;
}

interface FeedStock {
  feedName: string;
  quantity: number;
  avgDailyUsage: number;
  daysUntilEmpty: number;
  unit: string;
}

const FeedAnalyticsWidget = () => {
  const { currentBranchId } = useBranch();
  const [consumptionTrend, setConsumptionTrend] = useState<FeedConsumptionData[]>([]);
  const [feedStock, setFeedStock] = useState<FeedStock[]>([]);
  const [todayCost, setTodayCost] = useState(0);
  const [weekCost, setWeekCost] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, [currentBranchId]);

  const fetchAnalytics = async () => {
    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get feed types with prices
    let feedTypesQuery = supabase.from("feed_types").select("*");
    if (currentBranchId) feedTypesQuery = feedTypesQuery.eq("branch_id", currentBranchId);
    const { data: feedTypes } = await feedTypesQuery;
    const feedTypeMap = new Map(feedTypes?.map(f => [f.id, f]) || []);

    // Get consumption data for the last 30 days
    let consumptionQuery = supabase
      .from("feed_consumption")
      .select("*")
      .gte("date", monthAgo.toISOString().split('T')[0])
      .order("date", { ascending: true });
    if (currentBranchId) consumptionQuery = consumptionQuery.eq("branch_id", currentBranchId);
    const { data: consumption } = await consumptionQuery;

    // Get inventory data
    let inventoryQuery = supabase
      .from("feed_inventory")
      .select("*, feed_types(feed_name, price_per_unit)");
    if (currentBranchId) inventoryQuery = inventoryQuery.eq("branch_id", currentBranchId);
    const { data: inventory } = await inventoryQuery;

    // Calculate daily consumption trends
    const dailyData = new Map<string, { totalUsed: number; cost: number }>();
    
    consumption?.forEach(record => {
      const feedType = feedTypeMap.get(record.feed_type_id);
      const cost = feedType ? record.quantity_used * feedType.price_per_unit : 0;
      
      const existing = dailyData.get(record.date) || { totalUsed: 0, cost: 0 };
      dailyData.set(record.date, {
        totalUsed: existing.totalUsed + record.quantity_used,
        cost: existing.cost + cost,
      });
    });

    const trendData: FeedConsumptionData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const data = dailyData.get(dateStr) || { totalUsed: 0, cost: 0 };
      trendData.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        totalUsed: data.totalUsed,
        cost: data.cost,
      });
    }
    setConsumptionTrend(trendData);

    // Calculate costs
    const todayStr = today.toISOString().split('T')[0];
    const todayData = dailyData.get(todayStr);
    setTodayCost(todayData?.cost || 0);

    let weekTotal = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      weekTotal += dailyData.get(dateStr)?.cost || 0;
    }
    setWeekCost(weekTotal);

    // Calculate days until restock needed
    const avgDailyUsage = new Map<string, number>();
    const usageCount = new Map<string, number>();
    
    consumption?.forEach(record => {
      const existing = avgDailyUsage.get(record.feed_type_id) || 0;
      const count = usageCount.get(record.feed_type_id) || 0;
      avgDailyUsage.set(record.feed_type_id, existing + record.quantity_used);
      usageCount.set(record.feed_type_id, count + 1);
    });

    const stockData: FeedStock[] = inventory?.map(inv => {
      const totalUsed = avgDailyUsage.get(inv.feed_type_id) || 0;
      const days = usageCount.get(inv.feed_type_id) || 1;
      const avgDaily = totalUsed / days;
      const daysUntilEmpty = avgDaily > 0 ? Math.floor(inv.quantity_in_stock / avgDaily) : 999;
      
      return {
        feedName: inv.feed_types?.feed_name || 'Unknown',
        quantity: inv.quantity_in_stock,
        avgDailyUsage: Math.round(avgDaily * 10) / 10,
        daysUntilEmpty,
        unit: inv.unit,
      };
    }) || [];

    setFeedStock(stockData.sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Today's Feed Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{todayCost.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-accent" />
              Week's Feed Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{weekCost.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Avg Daily Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{Math.round(weekCost / 7).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feed Consumption Trend (7 Days)</CardTitle>
          <CardDescription>Daily feed usage in units</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consumptionTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="totalUsed" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Restock Forecast
          </CardTitle>
          <CardDescription>Estimated days until feed runs out</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {feedStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inventory data</p>
            ) : (
              feedStock.map((feed, index) => (
                <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">{feed.feedName}</p>
                    <p className="text-xs text-muted-foreground">
                      {feed.quantity} {feed.unit} left • {feed.avgDailyUsage} {feed.unit}/day avg
                    </p>
                  </div>
                  <div className={`text-right px-3 py-1 rounded-full text-sm font-medium ${
                    feed.daysUntilEmpty <= 3 ? 'bg-destructive/20 text-destructive' :
                    feed.daysUntilEmpty <= 7 ? 'bg-warning/20 text-warning' :
                    'bg-success/20 text-success'
                  }`}>
                    {feed.daysUntilEmpty >= 999 ? '∞' : `${feed.daysUntilEmpty} days`}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedAnalyticsWidget;
