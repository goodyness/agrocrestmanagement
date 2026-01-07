import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bird, DollarSign, TrendingUp, Calculator } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CategoryCost {
  categoryName: string;
  totalBirds: number;
  totalFeedCost: number;
  totalFeedUsed: number;
  costPerBird: number;
  feedPerBird: number;
  unit: string;
}

interface WeeklyData {
  week: string;
  feedCost: number;
  costPerBird: number;
}

const CostPerBirdAnalytics = () => {
  const [categoryCosts, setCategoryCosts] = useState<CategoryCost[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [totalCostPerBird, setTotalCostPerBird] = useState(0);
  const [totalBirds, setTotalBirds] = useState(0);
  const [totalFeedCost, setTotalFeedCost] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    // Get livestock census
    const { data: census } = await supabase
      .from("livestock_census")
      .select("*, livestock_categories(name)");

    // Get feed types with prices
    const { data: feedTypes } = await supabase.from("feed_types").select("*");
    const feedTypeMap = new Map(feedTypes?.map(f => [f.id, f]) || []);

    // Get feed consumption for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: consumption } = await supabase
      .from("feed_consumption")
      .select("*")
      .gte("date", thirtyDaysAgo.toISOString().split('T')[0]);

    // Calculate per-category costs
    const categoryMap = new Map<string, { 
      name: string; 
      birds: number; 
      feedCost: number; 
      feedUsed: number;
      unit: string;
    }>();

    // Initialize with census data
    census?.forEach(c => {
      categoryMap.set(c.livestock_category_id, {
        name: c.livestock_categories?.name || 'Unknown',
        birds: c.updated_count || c.total_count,
        feedCost: 0,
        feedUsed: 0,
        unit: 'kg',
      });
    });

    // Add feed consumption costs
    consumption?.forEach(record => {
      const feedType = feedTypeMap.get(record.feed_type_id);
      const cost = feedType ? record.quantity_used * feedType.price_per_unit : 0;
      
      const existing = categoryMap.get(record.livestock_category_id);
      if (existing) {
        existing.feedCost += cost;
        existing.feedUsed += record.quantity_used;
        existing.unit = record.unit;
      }
    });

    // Convert to array and calculate per-bird costs
    const costs: CategoryCost[] = [];
    let grandTotalBirds = 0;
    let grandTotalCost = 0;

    categoryMap.forEach((data, id) => {
      if (data.birds > 0) {
        costs.push({
          categoryName: data.name,
          totalBirds: data.birds,
          totalFeedCost: data.feedCost,
          totalFeedUsed: data.feedUsed,
          costPerBird: data.feedCost / data.birds,
          feedPerBird: data.feedUsed / data.birds,
          unit: data.unit,
        });
        grandTotalBirds += data.birds;
        grandTotalCost += data.feedCost;
      }
    });

    setCategoryCosts(costs.sort((a, b) => b.costPerBird - a.costPerBird));
    setTotalBirds(grandTotalBirds);
    setTotalFeedCost(grandTotalCost);
    setTotalCostPerBird(grandTotalBirds > 0 ? grandTotalCost / grandTotalBirds : 0);

    // Calculate weekly trends
    const weeklyMap = new Map<number, { feedCost: number; startDate: Date }>();
    
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7) - 6);
      weeklyMap.set(i, { feedCost: 0, startDate: weekStart });
    }

    consumption?.forEach(record => {
      const recordDate = new Date(record.date);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysDiff / 7);
      
      if (weekIndex < 4) {
        const feedType = feedTypeMap.get(record.feed_type_id);
        const cost = feedType ? record.quantity_used * feedType.price_per_unit : 0;
        const week = weeklyMap.get(weekIndex);
        if (week) {
          week.feedCost += cost;
        }
      }
    });

    const weekly: WeeklyData[] = [];
    weeklyMap.forEach((data, weekIndex) => {
      const weekLabel = weekIndex === 0 ? 'This Week' : 
                       weekIndex === 1 ? 'Last Week' :
                       `${weekIndex + 1} Weeks Ago`;
      weekly.unshift({
        week: weekLabel,
        feedCost: Math.round(data.feedCost),
        costPerBird: grandTotalBirds > 0 ? Math.round((data.feedCost / grandTotalBirds) * 100) / 100 : 0,
      });
    });

    setWeeklyData(weekly);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Feed Cost Per Bird Analysis
        </h2>
        <p className="text-muted-foreground">Understand your feed costs relative to livestock count</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bird className="h-4 w-4 text-primary" />
              Total Livestock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBirds.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active birds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-accent" />
              30-Day Feed Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalFeedCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total spent on feed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Avg Cost Per Bird
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalCostPerBird.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">30-day average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4 text-warning" />
              Daily Per Bird
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{(totalCostPerBird / 30).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Daily feed cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Feed Cost Trend</CardTitle>
          <CardDescription>Feed spending over the last 4 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'feedCost' ? `₦${value.toLocaleString()}` : `₦${value}`,
                    name === 'feedCost' ? 'Total Feed Cost' : 'Cost Per Bird'
                  ]}
                />
                <Legend />
                <Bar 
                  dataKey="feedCost" 
                  fill="hsl(var(--primary))" 
                  name="Total Feed Cost"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Per-Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Per Bird by Category</CardTitle>
          <CardDescription>30-day feed cost breakdown per livestock type</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryCosts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No feed consumption data available. Start recording feed usage to see analytics.
            </p>
          ) : (
            <div className="space-y-4">
              {categoryCosts.map((cat, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-foreground">{cat.categoryName}</h4>
                      <p className="text-sm text-muted-foreground">{cat.totalBirds} birds</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">₦{cat.costPerBird.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">per bird (30 days)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Feed Used</p>
                      <p className="font-medium">{cat.totalFeedUsed.toFixed(1)} {cat.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Feed Per Bird</p>
                      <p className="font-medium">{cat.feedPerBird.toFixed(2)} {cat.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Cost</p>
                      <p className="font-medium">₦{cat.totalFeedCost.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">
                      Daily cost: <span className="font-medium text-foreground">₦{(cat.costPerBird / 30).toFixed(2)}</span> per bird
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CostPerBirdAnalytics;
