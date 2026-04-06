import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SeasonalTrendAnalysis = () => {
  const { currentBranchId } = useBranch();
  const [metric, setMetric] = useState<"production" | "sales" | "mortality">("production");
  const [data, setData] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentBranchId, metric]);

  const fetchData = async () => {
    let records: any[] = [];

    if (metric === "production") {
      let q = supabase.from("daily_production").select("date, crates, pieces");
      if (currentBranchId) q = q.eq("branch_id", currentBranchId);
      const { data } = await q;
      records = data || [];
    } else if (metric === "sales") {
      let q = supabase.from("sales_records").select("date, total_amount");
      if (currentBranchId) q = q.eq("branch_id", currentBranchId);
      const { data } = await q;
      records = data || [];
    } else {
      let q = supabase.from("mortality_records").select("date, quantity_dead");
      if (currentBranchId) q = q.eq("branch_id", currentBranchId);
      const { data } = await q;
      records = data || [];
    }

    // Group by year and month
    const yearMonthMap: Record<number, Record<number, number>> = {};
    const yearsSet = new Set<number>();

    records.forEach((r) => {
      const d = new Date(r.date);
      const year = d.getFullYear();
      const month = d.getMonth();
      yearsSet.add(year);

      if (!yearMonthMap[year]) yearMonthMap[year] = {};
      
      let value = 0;
      if (metric === "production") value = (r.crates * 30) + (r.pieces || 0);
      else if (metric === "sales") value = Number(r.total_amount);
      else value = r.quantity_dead;

      yearMonthMap[year][month] = (yearMonthMap[year][month] || 0) + value;
    });

    const years = Array.from(yearsSet).sort();
    setAvailableYears(years);

    // Build chart data
    const chartData = MONTHS.map((name, i) => {
      const row: any = { month: name };
      years.forEach((y) => {
        row[y.toString()] = yearMonthMap[y]?.[i] || 0;
      });
      return row;
    });

    setData(chartData);
  };

  const colors = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "#8884d8"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Seasonal Trend Analysis
            </CardTitle>
            <CardDescription>Compare performance across seasons and years</CardDescription>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as any)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="sales">Sales (₦)</SelectItem>
              <SelectItem value="mortality">Mortality</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 && availableYears.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => metric === "sales" ? `₦${v.toLocaleString()}` : v.toLocaleString()}
                />
                <Legend />
                {availableYears.map((y, i) => (
                  <Bar key={y} dataKey={y.toString()} fill={colors[i % colors.length]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Not enough data for seasonal comparison yet.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["Dry Season (Nov-Mar)", "Rainy Season (Apr-Oct)"].map((season) => {
            const isDry = season.includes("Dry");
            const monthIndices = isDry ? [10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8, 9];
            const total = data
              .filter((_, i) => monthIndices.includes(i))
              .reduce((sum, row) => {
                return sum + availableYears.reduce((s, y) => s + (row[y.toString()] || 0), 0);
              }, 0);
            
            return (
              <Card key={season} className="p-3">
                <p className="text-xs text-muted-foreground">{season}</p>
                <p className="text-lg font-bold text-foreground">
                  {metric === "sales" ? `₦${total.toLocaleString()}` : total.toLocaleString()}
                </p>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SeasonalTrendAnalysis;
