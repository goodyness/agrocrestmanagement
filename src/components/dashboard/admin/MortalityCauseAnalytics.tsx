import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Skull, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { useBranch } from "@/contexts/BranchContext";
import { exportToCSV } from "@/lib/exportUtils";

const COLORS = ["hsl(var(--primary))", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#22c55e", "#ec4899", "#64748b"];

const seasonOf = (d: Date) => {
  // Nigeria: wet season roughly April–October, dry November–March
  const m = d.getMonth() + 1;
  return m >= 4 && m <= 10 ? "Wet season" : "Dry season";
};

const ageBucket = (weeks: number | null) => {
  if (weeks == null) return "Unknown age";
  if (weeks <= 2) return "0-2 wks (brooding)";
  if (weeks <= 6) return "3-6 wks (grower)";
  if (weeks <= 12) return "7-12 wks";
  if (weeks <= 24) return "13-24 wks";
  return "25+ wks";
};

const normalizeCause = (reason: string | null) => {
  const r = (reason || "").trim().toLowerCase();
  if (!r) return "Unspecified";
  if (/disease|sick|infect|coccid|newcastle|gumboro|cold|flu/.test(r)) return "Disease";
  if (/heat|hot|temperature|weather|cold stress/.test(r)) return "Heat / weather";
  if (/predator|snake|rat|hawk|dog/.test(r)) return "Predator";
  if (/injur|trample|crush|accident|stampede/.test(r)) return "Injury / trampling";
  if (/feed|water|starv|dehydr|nutri/.test(r)) return "Feed / water issue";
  if (/weak|runt|small|culled|cull/.test(r)) return "Weak / culled";
  if (/vaccin|medic|drug|dosage/.test(r)) return "Vaccine / medication";
  return r.charAt(0).toUpperCase() + r.slice(1);
};

const MortalityCauseAnalytics = () => {
  const { currentBranchId } = useBranch();
  const [records, setRecords] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [range, setRange] = useState("180");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - Number(range) * 86400000).toISOString().split("T")[0];
      let mq = supabase.from("mortality_records").select("*").gte("date", since).order("date", { ascending: true });
      let bq = supabase.from("livestock_batches").select("*");
      if (currentBranchId) {
        mq = mq.eq("branch_id", currentBranchId);
        bq = bq.eq("branch_id", currentBranchId);
      }
      const [{ data: m }, { data: b }] = await Promise.all([mq, bq]);
      setRecords(m || []);
      setBatches(b || []);
      setLoading(false);
    })();
  }, [currentBranchId, range]);

  const enriched = useMemo(() => {
    const bmap = new Map(batches.map((b) => [b.id, b]));
    return records.map((r) => {
      const b = r.batch_id ? bmap.get(r.batch_id) : null;
      const d = new Date(r.date);
      let ageWeeks: number | null = null;
      if (b?.date_acquired) {
        ageWeeks = Math.max(0, Math.floor((d.getTime() - new Date(b.date_acquired).getTime()) / (7 * 86400000)));
      }
      return {
        ...r,
        qty: Number(r.quantity_dead || 0),
        cause: normalizeCause(r.reason),
        season: seasonOf(d),
        ageBucket: ageBucket(ageWeeks),
        ageWeeks,
        breed: b?.species || "Unassigned",
        supplier: b?.source || b?.expected_source || "Unknown source",
        batchLabel: b ? `${b.species} • ${b.date_acquired}` : "No batch",
        month: r.date.slice(0, 7),
      };
    });
  }, [records, batches]);

  const totalDeaths = enriched.reduce((s, r) => s + r.qty, 0);

  const group = (key: string) => {
    const map: Record<string, number> = {};
    enriched.forEach((r: any) => { map[r[key]] = (map[r[key]] || 0) + r.qty; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const byCause = useMemo(() => group("cause"), [enriched]);
  const byBreed = useMemo(() => group("breed"), [enriched]);

  const causeByAge = useMemo(() => {
    const buckets = ["0-2 wks (brooding)", "3-6 wks (grower)", "7-12 wks", "13-24 wks", "25+ wks", "Unknown age"];
    const topCauses = byCause.slice(0, 5).map((c) => c.name);
    return buckets.map((bucket) => {
      const row: any = { bucket };
      topCauses.forEach((c) => { row[c] = 0; });
      enriched.filter((r: any) => r.ageBucket === bucket).forEach((r: any) => {
        if (topCauses.includes(r.cause)) row[r.cause] += r.qty;
      });
      return row;
    }).filter((r) => Object.keys(r).some((k) => k !== "bucket" && r[k] > 0));
  }, [enriched, byCause]);

  const topCauseNames = byCause.slice(0, 5).map((c) => c.name);

  const seasonSplit = useMemo(() => {
    const causes = byCause.slice(0, 6).map((c) => c.name);
    return causes.map((c) => ({
      cause: c,
      "Wet season": enriched.filter((r: any) => r.cause === c && r.season === "Wet season").reduce((s, r: any) => s + r.qty, 0),
      "Dry season": enriched.filter((r: any) => r.cause === c && r.season === "Dry season").reduce((s, r: any) => s + r.qty, 0),
    }));
  }, [enriched, byCause]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    enriched.forEach((r: any) => { map[r.month] = (map[r.month] || 0) + r.qty; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, deaths]) => ({ month, deaths }));
  }, [enriched]);

  // Risk drivers: supplier/breed pairs with deaths relative to stocked quantity
  const riskDrivers = useMemo(() => {
    const map: Record<string, { key: string; supplier: string; breed: string; deaths: number; stocked: number }> = {};
    batches.forEach((b) => {
      const key = `${b.source || b.expected_source || "Unknown source"}|${b.species}`;
      map[key] = map[key] || { key, supplier: b.source || b.expected_source || "Unknown source", breed: b.species, deaths: 0, stocked: 0 };
      map[key].stocked += Number(b.quantity || 0);
    });
    enriched.forEach((r: any) => {
      const key = `${r.supplier}|${r.breed}`;
      map[key] = map[key] || { key, supplier: r.supplier, breed: r.breed, deaths: 0, stocked: 0 };
      map[key].deaths += r.qty;
    });
    return Object.values(map)
      .map((v) => ({ ...v, rate: v.stocked > 0 ? (v.deaths / v.stocked) * 100 : 0 }))
      .filter((v) => v.deaths > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 8);
  }, [enriched, batches]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Skull className="h-4 w-4 text-destructive" />
              Mortality Cause Analytics
            </CardTitle>
            <CardDescription>Deaths clustered by cause, batch age, season, supplier and breed</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 6 months</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => exportToCSV(enriched.map((r: any) => ({
              date: r.date, deaths: r.qty, cause: r.cause, age_bucket: r.ageBucket, season: r.season, breed: r.breed, supplier: r.supplier, batch: r.batchLabel,
            })), "mortality-cause-analytics")}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Total deaths</p>
            <p className="text-2xl font-bold">{totalDeaths.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Leading cause</p>
            <p className="text-lg font-bold truncate">{byCause[0]?.name || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {byCause[0] ? `${byCause[0].value} deaths (${totalDeaths ? ((byCause[0].value / totalDeaths) * 100).toFixed(0) : 0}%)` : ""}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Riskiest age window</p>
            <p className="text-lg font-bold truncate">
              {causeByAge.length
                ? causeByAge.reduce((best: any, r: any) => {
                    const sum = topCauseNames.reduce((s, c) => s + (r[c] || 0), 0);
                    return !best || sum > best.sum ? { bucket: r.bucket, sum } : best;
                  }, null)?.bucket
                : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : totalDeaths === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No mortality records in this period.</CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Deaths by cause</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCause} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => e.name}>
                    {byCause.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cause × batch age</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={causeByAge}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="bucket" fontSize={9} />
                  <YAxis fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  {topCauseNames.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={COLORS[i % COLORS.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cause × season</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seasonSplit}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="cause" fontSize={9} />
                  <YAxis fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="Wet season" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dry season" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly death trend</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="deaths" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Top risk drivers (supplier × breed)
              </CardTitle>
              <CardDescription>Death rate against total stocked from that source</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {riskDrivers.map((r) => (
                <div key={r.key} className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.supplier}</p>
                    <p className="text-xs text-muted-foreground">{r.breed} • {r.deaths} deaths of {r.stocked || "?"} stocked</p>
                  </div>
                  <Badge variant={r.rate >= 10 ? "destructive" : r.rate >= 5 ? "secondary" : "outline"}>
                    {r.rate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
              {riskDrivers.length === 0 && <p className="text-sm text-muted-foreground">Not enough linked batch data.</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Deaths by breed</CardTitle></CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBreed} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={110} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MortalityCauseAnalytics;
