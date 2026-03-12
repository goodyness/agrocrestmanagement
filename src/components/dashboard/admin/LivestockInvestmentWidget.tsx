import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Egg } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid, Legend } from "recharts";

interface BatchInvestment {
  id: string;
  species: string;
  species_type: string | null;
  quantity: number;
  current_quantity: number;
  total_cost: number;
  age_weeks: number | null;
  is_active: boolean;
  expenses: number;
  date_acquired: string;
}

interface InvestmentTimePoint {
  date: string;
  label: string;
  investment: number;
  revenue: number;
  profit: number;
}

const LivestockInvestmentWidget = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<BatchInvestment[]>([]);
  const [totalEggRevenue, setTotalEggRevenue] = useState(0);
  const [chartData, setChartData] = useState<InvestmentTimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch active batches
    let batchQuery = supabase
      .from("livestock_batches")
      .select("id, species, species_type, quantity, current_quantity, total_cost, age_weeks, is_active, date_acquired")
      .eq("is_active", true);
    if (currentBranchId) batchQuery = batchQuery.eq("branch_id", currentBranchId);
    const { data: batchData } = await batchQuery;

    if (!batchData || batchData.length === 0) {
      setBatches([]);
      setLoading(false);
      return;
    }

    const batchIds = batchData.map((b) => b.id);

    // Fetch expenses for these batches
    const { data: expData } = await supabase
      .from("miscellaneous_expenses")
      .select("batch_id, amount, date")
      .in("batch_id", batchIds);

    // Fetch all egg sales revenue (product_type = 'eggs')
    let eggSalesQuery = supabase
      .from("sales_records")
      .select("total_amount, date")
      .eq("product_type", "eggs");
    if (currentBranchId) eggSalesQuery = eggSalesQuery.eq("branch_id", currentBranchId);
    const { data: eggSalesData } = await eggSalesQuery;

    const eggRevenue = eggSalesData?.reduce((s, r) => s + Number(r.total_amount), 0) || 0;
    setTotalEggRevenue(eggRevenue);

    // Map expenses to batches
    const expByBatch: Record<string, number> = {};
    expData?.forEach((e) => {
      if (e.batch_id) {
        expByBatch[e.batch_id] = (expByBatch[e.batch_id] || 0) + Number(e.amount);
      }
    });

    const enriched: BatchInvestment[] = batchData.map((b) => ({
      ...b,
      total_cost: Number(b.total_cost || 0),
      expenses: expByBatch[b.id] || 0,
    }));

    setBatches(enriched);

    // Build timeline chart data (monthly)
    buildChartData(batchData, expData || [], eggSalesData || []);

    setLoading(false);
  };

  const buildChartData = (
    batchData: any[],
    expData: any[],
    eggSalesData: any[]
  ) => {
    // Get date range
    const allDates = [
      ...batchData.map((b) => b.date_acquired),
      ...expData.map((e) => e.date),
      ...eggSalesData.map((s) => s.date),
    ].filter(Boolean).sort();

    if (allDates.length === 0) { setChartData([]); return; }

    const startDate = new Date(allDates[0]);
    const endDate = new Date();
    const months: InvestmentTimePoint[] = [];

    let cumInvestment = 0;
    let cumRevenue = 0;

    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (current <= endDate) {
      const monthStr = current.toISOString().slice(0, 7); // YYYY-MM
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);

      // Purchase costs this month
      const purchaseThisMonth = batchData
        .filter((b) => b.date_acquired >= monthStr + "-01" && b.date_acquired < nextMonth.toISOString().slice(0, 10))
        .reduce((s, b) => s + Number(b.total_cost || 0), 0);

      // Expenses this month
      const expThisMonth = expData
        .filter((e) => e.date >= monthStr + "-01" && e.date < nextMonth.toISOString().slice(0, 10))
        .reduce((s, e) => s + Number(e.amount), 0);

      // Revenue this month
      const revThisMonth = eggSalesData
        .filter((s) => s.date >= monthStr + "-01" && s.date < nextMonth.toISOString().slice(0, 10))
        .reduce((s, r) => s + Number(r.total_amount), 0);

      cumInvestment += purchaseThisMonth + expThisMonth;
      cumRevenue += revThisMonth;

      months.push({
        date: monthStr,
        label: current.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        investment: cumInvestment,
        revenue: cumRevenue,
        profit: cumRevenue - cumInvestment,
      });

      current.setMonth(current.getMonth() + 1);
    }

    setChartData(months);
  };

  const totalPurchaseCost = batches.reduce((s, b) => s + b.total_cost, 0);
  const totalExpenses = batches.reduce((s, b) => s + b.expenses, 0);
  const totalInvestment = totalPurchaseCost + totalExpenses;
  const totalBirds = batches.reduce((s, b) => s + b.current_quantity, 0);
  const totalMortality = batches.reduce((s, b) => s + (b.quantity - b.current_quantity), 0);
  const avgCostPerBird = totalBirds > 0 ? totalInvestment / totalBirds : 0;
  const totalOriginal = batches.reduce((s, b) => s + b.quantity, 0);
  const mortalityRate = totalOriginal > 0 ? (totalMortality / totalOriginal) * 100 : 0;
  const roi = totalInvestment > 0 ? ((totalEggRevenue - totalInvestment) / totalInvestment) * 100 : 0;
  const netProfit = totalEggRevenue - totalInvestment;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading investment data...</CardContent>
      </Card>
    );
  }

  if (batches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Livestock Investment & ROI
          </CardTitle>
          <CardDescription>{batches.length} active batch{batches.length !== 1 ? "es" : ""} • {totalBirds.toLocaleString()} animals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Purchase Cost</p>
              <p className="text-lg font-bold">₦{totalPurchaseCost.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Added Expenses</p>
              <p className="text-lg font-bold">₦{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-xs text-muted-foreground">Total Investment</p>
              <p className="text-lg font-bold text-primary">₦{totalInvestment.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Egg className="h-3 w-3" /> Egg Revenue</p>
              <p className="text-lg font-bold text-green-600">₦{totalEggRevenue.toLocaleString()}</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${netProfit >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
              <p className="text-xs text-muted-foreground">Net Profit</p>
              <p className={`text-lg font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                ₦{netProfit.toLocaleString()}
              </p>
            </div>
            <div className={`p-3 rounded-lg text-center ${roi >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
              <p className="text-xs text-muted-foreground">ROI</p>
              <p className={`text-lg font-bold ${roi >= 0 ? "text-green-600" : "text-destructive"}`}>
                {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Cost per bird */}
          <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cost/Bird (alive)</span>
            <span className="font-bold">₦{avgCostPerBird.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>

          {/* Mortality impact */}
          {totalMortality > 0 && (
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/5 border border-destructive/20">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-sm">
                <strong>{totalMortality}</strong> mortality ({mortalityRate.toFixed(1)}%) — estimated loss: ₦{(totalMortality * avgCostPerBird).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}

          {/* Per-batch breakdown */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Per Batch</p>
            {batches.map((b) => {
              const batchInvestment = b.total_cost + b.expenses;
              const batchMortality = b.quantity - b.current_quantity;
              return (
                <div key={b.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{b.species_type || b.species}</Badge>
                    <span>{b.current_quantity}/{b.quantity} birds</span>
                    {b.age_weeks != null && <span className="text-muted-foreground">• {b.age_weeks}wks</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {batchMortality > 0 && (
                      <span className="text-xs text-destructive">-{batchMortality}</span>
                    )}
                    <span className="font-medium">₦{batchInvestment.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Investment Growth Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Investment vs Revenue Over Time
            </CardTitle>
            <CardDescription>Cumulative monthly trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="investmentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [`₦${value.toLocaleString()}`, name === "investment" ? "Investment" : name === "revenue" ? "Egg Revenue" : "Profit"]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="investment" stroke="hsl(var(--primary))" fill="url(#investmentGrad)" name="Investment" strokeWidth={2} />
                  <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revenueGrad)" name="Egg Revenue" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Net Profit" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LivestockInvestmentWidget;
