import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Flame, TrendingUp } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

interface ProfitData {
  name: string;
  revenue: number;
  expenses: number;
  profit: number;
  profitPerDay: number;
}

const ProfitabilityHeatmap = () => {
  const { currentBranchId } = useBranch();
  const [view, setView] = useState<"product" | "daily">("product");
  const [data, setData] = useState<ProfitData[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    fetchData();
  }, [currentBranchId, period, view]);

  const fetchData = async () => {
    const startDate = new Date(Date.now() - parseInt(period) * 86400000).toISOString().split("T")[0];

    if (view === "product") {
      let salesQ = supabase.from("sales_records").select("product_type, total_amount").gte("date", startDate);
      if (currentBranchId) salesQ = salesQ.eq("branch_id", currentBranchId);
      const { data: sales } = await salesQ;

      const byProduct: Record<string, number> = {};
      (sales || []).forEach(s => {
        byProduct[s.product_type] = (byProduct[s.product_type] || 0) + Number(s.total_amount);
      });

      const days = parseInt(period);
      const result = Object.entries(byProduct)
        .map(([name, revenue]) => ({
          name,
          revenue,
          expenses: 0,
          profit: revenue,
          profitPerDay: Math.round(revenue / days),
        }))
        .sort((a, b) => b.profitPerDay - a.profitPerDay);

      setData(result);
    } else {
      // Daily P&L
      let salesQ = supabase.from("sales_records").select("date, total_amount").gte("date", startDate);
      let expQ = supabase.from("miscellaneous_expenses").select("date, amount").gte("date", startDate);
      if (currentBranchId) {
        salesQ = salesQ.eq("branch_id", currentBranchId);
        expQ = expQ.eq("branch_id", currentBranchId);
      }

      const [{ data: sales }, { data: expenses }] = await Promise.all([salesQ, expQ]);

      const byDate: Record<string, { revenue: number; expenses: number }> = {};
      (sales || []).forEach(s => {
        if (!byDate[s.date]) byDate[s.date] = { revenue: 0, expenses: 0 };
        byDate[s.date].revenue += Number(s.total_amount);
      });
      (expenses || []).forEach(e => {
        if (!byDate[e.date]) byDate[e.date] = { revenue: 0, expenses: 0 };
        byDate[e.date].expenses += Number(e.amount);
      });

      const result = Object.entries(byDate)
        .map(([date, vals]) => ({
          date: new Date(date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
          revenue: vals.revenue,
          expenses: vals.expenses,
          profit: vals.revenue - vals.expenses,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyData(result);
    }
  };

  const getColor = (profit: number, maxProfit: number) => {
    if (profit <= 0) return "hsl(var(--destructive))";
    const intensity = Math.min(profit / (maxProfit || 1), 1);
    if (intensity > 0.7) return "hsl(142, 76%, 36%)";
    if (intensity > 0.4) return "hsl(142, 60%, 50%)";
    return "hsl(142, 40%, 65%)";
  };

  const maxProfit = Math.max(...data.map(d => d.profitPerDay), 1);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Profitability Heatmap
            </CardTitle>
            <CardDescription>Which products and days generate the most profit</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={view} onValueChange={(v) => setView(v as any)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">By Product</SelectItem>
                <SelectItem value="daily">Daily P&L</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === "product" ? (
          <>
            {data.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No sales data for this period</p>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                      <Bar dataKey="profitPerDay" name="Profit/Day">
                        {data.map((entry, i) => (
                          <Cell key={i} fill={getColor(entry.profitPerDay, maxProfit)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Heatmap grid */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {data.map((item) => (
                    <div
                      key={item.name}
                      className="p-3 rounded-lg border text-center"
                      style={{
                        backgroundColor: `hsl(142, 76%, ${95 - (item.profitPerDay / maxProfit) * 50}%)`,
                      }}
                    >
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-lg font-bold">₦{item.profitPerDay.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">per day</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {dailyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data for this period</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                    <Bar dataKey="profit" name="Daily Profit">
                      {dailyData.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "hsl(142, 76%, 36%)" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfitabilityHeatmap;
