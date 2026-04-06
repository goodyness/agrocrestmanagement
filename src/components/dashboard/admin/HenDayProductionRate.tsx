import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Egg, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBranch } from "@/contexts/BranchContext";
import { format, subDays } from "date-fns";

const HenDayProductionRate = () => {
  const { currentBranchId } = useBranch();
  const [data, setData] = useState<{ date: string; rate: number; pieces: number; hens: number }[]>([]);
  const [todayRate, setTodayRate] = useState(0);
  const [avgRate, setAvgRate] = useState(0);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    const days = 30;
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

    // Get total laying hens (active batches with has_started_laying = true)
    let batchQuery = supabase
      .from("livestock_batches")
      .select("current_quantity")
      .eq("is_active", true)
      .eq("has_started_laying", true);
    if (currentBranchId) batchQuery = batchQuery.eq("branch_id", currentBranchId);
    const { data: batches } = await batchQuery;
    const totalHens = batches?.reduce((sum, b) => sum + b.current_quantity, 0) || 0;

    // Get daily production for last 30 days
    let prodQuery = supabase
      .from("daily_production")
      .select("date, pieces, crates")
      .gte("date", startDate)
      .order("date", { ascending: true });
    if (currentBranchId) prodQuery = prodQuery.eq("branch_id", currentBranchId);
    const { data: production } = await prodQuery;

    // Aggregate by date
    const dateMap: Record<string, number> = {};
    production?.forEach((p) => {
      const totalPieces = (p.crates * 30) + p.pieces;
      dateMap[p.date] = (dateMap[p.date] || 0) + totalPieces;
    });

    const chartData = Object.entries(dateMap).map(([date, pieces]) => ({
      date: format(new Date(date), "MMM dd"),
      rate: totalHens > 0 ? Math.round((pieces / totalHens) * 100) : 0,
      pieces,
      hens: totalHens,
    }));

    setData(chartData);

    if (chartData.length > 0) {
      setTodayRate(chartData[chartData.length - 1].rate);
      setAvgRate(Math.round(chartData.reduce((s, d) => s + d.rate, 0) / chartData.length));
    }
  };

  const getRating = (rate: number) => {
    if (rate >= 85) return { label: "Excellent", color: "bg-success/20 text-success" };
    if (rate >= 70) return { label: "Good", color: "bg-primary/20 text-primary" };
    if (rate >= 50) return { label: "Fair", color: "bg-warning/20 text-warning" };
    return { label: "Low", color: "bg-destructive/20 text-destructive" };
  };

  const rating = getRating(todayRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Egg className="h-5 w-5 text-primary" />
          Hen-Day Production Rate
        </CardTitle>
        <CardDescription>Industry-standard KPI: % of hens laying per day</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-3xl font-bold text-foreground">{todayRate}%</div>
            <p className="text-xs text-muted-foreground">Today's rate</p>
          </div>
          <Badge className={rating.color}>{rating.label}</Badge>
          <div className="ml-auto text-right">
            <div className="text-lg font-semibold text-foreground flex items-center gap-1">
              {avgRate > todayRate ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : (
                <TrendingUp className="h-4 w-4 text-success" />
              )}
              {avgRate}%
            </div>
            <p className="text-xs text-muted-foreground">30-day avg</p>
          </div>
        </div>

        {data.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis unit="%" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Rate"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          💡 Industry benchmark: 80-95% for healthy commercial layers. Below 70% may indicate health or feed issues.
        </p>
      </CardContent>
    </Card>
  );
};

export default HenDayProductionRate;
