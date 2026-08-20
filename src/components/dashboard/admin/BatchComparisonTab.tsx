import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, GitCompareArrows, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useBranch } from "@/contexts/BranchContext";
import { exportToCSV } from "@/lib/exportUtils";

interface Metrics {
  batch: any;
  startCount: number;
  currentCount: number;
  deaths: number;
  mortalityRate: number;
  feedKg: number;
  fcr: number | null;
  avgWeightKg: number | null;
  purchaseCost: number;
  expenses: number;
  totalCost: number;
  costPerBird: number;
  revenue: number;
  profit: number;
  profitPerBird: number;
  cycleDays: number;
}

const naira = (v: number) => `₦${Math.round(v).toLocaleString()}`;

const BatchComparisonTab = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<any[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [left, setLeft] = useState<Metrics | null>(null);
  const [right, setRight] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      let q = supabase.from("livestock_batches").select("*").order("date_acquired", { ascending: false });
      if (currentBranchId) q = q.eq("branch_id", currentBranchId);
      const { data } = await q;
      setBatches(data || []);
    })();
  }, [currentBranchId]);

  const loadMetrics = async (batchId: string): Promise<Metrics | null> => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return null;

    const [{ data: mort }, { data: feed }, { data: fcr }, { data: exp }, { data: sales }, { data: feedTypes }] =
      await Promise.all([
        supabase.from("mortality_records").select("quantity_dead").eq("batch_id", batchId),
        supabase.from("feed_consumption").select("quantity_used, feed_type_id").eq("batch_id", batchId),
        supabase.from("batch_fcr_records").select("fcr, avg_weight_g, record_date").eq("batch_id", batchId).order("record_date", { ascending: false }),
        supabase.from("miscellaneous_expenses").select("amount").eq("batch_id", batchId),
        supabase.from("batch_sales").select("total_amount, quantity").eq("batch_id", batchId),
        supabase.from("feed_types").select("id, price_per_unit"),
      ]);

    const priceMap = new Map((feedTypes || []).map((f: any) => [f.id, Number(f.price_per_unit || 0)]));
    const deaths = (mort || []).reduce((s: number, r: any) => s + Number(r.quantity_dead || 0), 0);
    const feedKg = (feed || []).reduce((s: number, r: any) => s + Number(r.quantity_used || 0), 0);
    const feedCost = (feed || []).reduce((s: number, r: any) => s + Number(r.quantity_used || 0) * (priceMap.get(r.feed_type_id) || 0), 0);
    const startCount = Number(batch.quantity || 0);
    const currentCount = Number(batch.current_quantity ?? Math.max(startCount - deaths, 0));
    const purchaseCost = Number(batch.total_cost || 0) || Number(batch.cost_per_unit || 0) * startCount;
    const expenses = (exp || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const totalCost = purchaseCost + expenses + feedCost;
    const revenue = (sales || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
    const latestFcr = (fcr || []).find((r: any) => r.fcr != null);
    const latestWeight = (fcr || []).find((r: any) => r.avg_weight_g != null);
    const acquired = batch.date_acquired ? new Date(batch.date_acquired) : null;
    const cycleDays = acquired ? Math.max(0, Math.round((Date.now() - acquired.getTime()) / 86400000)) : 0;

    return {
      batch,
      startCount,
      currentCount,
      deaths,
      mortalityRate: startCount > 0 ? (deaths / startCount) * 100 : 0,
      feedKg,
      fcr: latestFcr ? Number(latestFcr.fcr) : null,
      avgWeightKg: latestWeight ? Number(latestWeight.avg_weight_g) / 1000 : null,
      purchaseCost,
      expenses: expenses + feedCost,
      totalCost,
      costPerBird: startCount > 0 ? totalCost / startCount : 0,
      revenue,
      profit: revenue - totalCost,
      profitPerBird: startCount > 0 ? (revenue - totalCost) / startCount : 0,
      cycleDays,
    };
  };

  useEffect(() => {
    if (!leftId && !rightId) return;
    setLoading(true);
    Promise.all([leftId ? loadMetrics(leftId) : null, rightId ? loadMetrics(rightId) : null])
      .then(([l, r]) => {
        setLeft(l);
        setRight(r);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftId, rightId, batches]);

  const rows = useMemo(() => {
    if (!left || !right) return [];
    return [
      { label: "Species / Stage", a: `${left.batch.species}${left.batch.stage ? ` • ${left.batch.stage}` : ""}`, b: `${right.batch.species}${right.batch.stage ? ` • ${right.batch.stage}` : ""}`, raw: null, better: "none" as const },
      { label: "Starting count", a: left.startCount.toLocaleString(), b: right.startCount.toLocaleString(), raw: [left.startCount, right.startCount], better: "high" as const },
      { label: "Alive now", a: left.currentCount.toLocaleString(), b: right.currentCount.toLocaleString(), raw: [left.currentCount, right.currentCount], better: "high" as const },
      { label: "Mortality rate", a: `${left.mortalityRate.toFixed(1)}%`, b: `${right.mortalityRate.toFixed(1)}%`, raw: [left.mortalityRate, right.mortalityRate], better: "low" as const },
      { label: "FCR (latest)", a: left.fcr?.toFixed(2) ?? "—", b: right.fcr?.toFixed(2) ?? "—", raw: [left.fcr ?? 0, right.fcr ?? 0], better: "low" as const },
      { label: "Avg weight (kg)", a: left.avgWeightKg?.toFixed(2) ?? "—", b: right.avgWeightKg?.toFixed(2) ?? "—", raw: [left.avgWeightKg ?? 0, right.avgWeightKg ?? 0], better: "high" as const },
      { label: "Feed used (kg)", a: left.feedKg.toLocaleString(), b: right.feedKg.toLocaleString(), raw: [left.feedKg, right.feedKg], better: "none" as const },
      { label: "Total cost", a: naira(left.totalCost), b: naira(right.totalCost), raw: [left.totalCost, right.totalCost], better: "low" as const },
      { label: "Cost / bird", a: naira(left.costPerBird), b: naira(right.costPerBird), raw: [left.costPerBird, right.costPerBird], better: "low" as const },
      { label: "Revenue", a: naira(left.revenue), b: naira(right.revenue), raw: [left.revenue, right.revenue], better: "high" as const },
      { label: "Profit", a: naira(left.profit), b: naira(right.profit), raw: [left.profit, right.profit], better: "high" as const },
      { label: "Profit / bird", a: naira(left.profitPerBird), b: naira(right.profitPerBird), raw: [left.profitPerBird, right.profitPerBird], better: "high" as const },
      { label: "Cycle length (days)", a: `${left.cycleDays}`, b: `${right.cycleDays}`, raw: [left.cycleDays, right.cycleDays], better: "none" as const },
    ];
  }, [left, right]);

  const chartData = useMemo(() => {
    if (!left || !right) return [];
    return [
      { metric: "Mortality %", "Batch A": +left.mortalityRate.toFixed(2), "Batch B": +right.mortalityRate.toFixed(2) },
      { metric: "FCR", "Batch A": left.fcr ?? 0, "Batch B": right.fcr ?? 0 },
      { metric: "Cost/bird (₦100s)", "Batch A": +(left.costPerBird / 100).toFixed(1), "Batch B": +(right.costPerBird / 100).toFixed(1) },
      { metric: "Profit/bird (₦100s)", "Batch A": +(left.profitPerBird / 100).toFixed(1), "Batch B": +(right.profitPerBird / 100).toFixed(1) },
    ];
  }, [left, right]);


  const label = (b: any) =>
    `${b.species}${b.stage ? ` (${b.stage})` : ""} • ${b.quantity} • ${b.date_acquired}`;

  const winner = (row: any, side: "a" | "b") => {
    if (!row.raw || row.better === "none") return null;
    const [x, y] = row.raw;
    if (x === y || (!x && !y)) return <Minus className="h-3 w-3 text-muted-foreground" />;
    const aWins = row.better === "high" ? x > y : (x || Infinity) < (y || Infinity);
    const isWinner = side === "a" ? aWins : !aWins;
    return isWinner ? <ArrowUp className="h-3 w-3 text-success" /> : <ArrowDown className="h-3 w-3 text-destructive" />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            Batch-to-Batch Comparison
          </CardTitle>
          <CardDescription>Pick two batches to compare performance side by side</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Batch A</p>
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger><SelectValue placeholder="Select batch A" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {batches.map((b) => <SelectItem key={b.id} value={b.id}>{label(b)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Batch B</p>
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger><SelectValue placeholder="Select batch B" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {batches.map((b) => <SelectItem key={b.id} value={b.id}>{label(b)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!left || !right ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {loading ? "Loading…" : "Select two batches to see the comparison."}
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Side-by-side metrics</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => exportToCSV(rows.map((r) => ({ metric: r.label, batch_a: r.a, batch_b: r.b })), "batch-comparison")}>
                <Download className="h-3 w-3 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-3 font-medium text-muted-foreground">Metric</th>
                    <th className="py-2 pr-3 font-medium">A · {left.batch.species} <Badge variant="secondary" className="ml-1">{left.batch.date_acquired}</Badge></th>
                    <th className="py-2 font-medium">B · {right.batch.species} <Badge variant="secondary" className="ml-1">{right.batch.date_acquired}</Badge></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-muted-foreground">{r.label}</td>
                      <td className="py-2 pr-3"><span className="inline-flex items-center gap-1 font-medium">{r.a} {winner(r, "a")}</span></td>
                      <td className="py-2"><span className="inline-flex items-center gap-1 font-medium">{r.b} {winner(r, "b")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Key metric comparison</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="metric" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="Batch A" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Batch B" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default BatchComparisonTab;
