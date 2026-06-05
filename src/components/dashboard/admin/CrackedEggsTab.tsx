import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, TrendingUp, Egg } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { format, subDays, startOfDay } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const PIECES_PER_CRATE = 30;
const ITEMS_PER_PAGE = 15;
const REASON_COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "#8884d8", "#82ca9d", "#ffc658"];

const CrackedEggsTab = () => {
  const { currentBranchId } = useBranch();
  const [records, setRecords] = useState<any[]>([]);
  const [allProduction, setAllProduction] = useState<any[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
      let q = supabase
        .from("daily_production")
        .select("*, profiles(name)")
        .gte("date", startDate)
        .order("date", { ascending: false });
      if (currentBranchId) q = q.eq("branch_id", currentBranchId);
      const { data } = await q;
      setAllProduction(data || []);
      setRecords((data || []).filter((r: any) => r.egg_type === "cracked"));
    })();
  }, [currentBranchId, days]);

  const stats = useMemo(() => {
    const totalCrackedPieces = records.reduce((s, r) => s + r.crates * PIECES_PER_CRATE + r.pieces, 0);
    const totalGoodPieces = allProduction
      .filter((r) => r.egg_type !== "cracked")
      .reduce((s, r) => s + r.crates * PIECES_PER_CRATE + r.pieces, 0);
    const totalAll = totalCrackedPieces + totalGoodPieces;
    const crackRate = totalAll > 0 ? (totalCrackedPieces / totalAll) * 100 : 0;
    const avgPerDay = days > 0 ? totalCrackedPieces / days : 0;
    return { totalCrackedPieces, totalGoodPieces, crackRate, avgPerDay };
  }, [records, allProduction, days]);

  // Daily series
  const dailySeries = useMemo(() => {
    const map: Record<string, { date: string; cracked: number; good: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      map[d] = { date: format(subDays(new Date(), i), "MMM dd"), cracked: 0, good: 0 };
    }
    allProduction.forEach((r) => {
      const key = r.date;
      if (!map[key]) return;
      const pcs = r.crates * PIECES_PER_CRATE + r.pieces;
      if (r.egg_type === "cracked") map[key].cracked += pcs;
      else map[key].good += pcs;
    });
    return Object.values(map);
  }, [allProduction, days]);

  // Reason breakdown
  const reasonBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      const base = (r.crack_reason || "Unspecified").split(" — ")[0];
      const pcs = r.crates * PIECES_PER_CRATE + r.pieces;
      map[base] = (map[base] || 0) + pcs;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  const rateBadge =
    stats.crackRate < 2
      ? { label: "Excellent", color: "bg-success/20 text-success" }
      : stats.crackRate < 5
      ? { label: "Acceptable", color: "bg-primary/20 text-primary" }
      : stats.crackRate < 8
      ? { label: "High", color: "bg-warning/20 text-warning" }
      : { label: "Critical", color: "bg-destructive/20 text-destructive" };

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: records.length, itemsPerPage: ITEMS_PER_PAGE,
  });
  const paginated = records.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" /> Cracked Egg Tracking
          </h2>
          <p className="text-muted-foreground">Monitor breakage rate and root causes</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-sm rounded-md border ${days === d ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Crack Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.crackRate.toFixed(2)}%</div>
            <Badge className={`mt-1 ${rateBadge.color}`}>{rateBadge.label}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Cracked</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.totalCrackedPieces.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">pieces in {days}d</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Avg Cracked / Day</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPerDay.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">pieces per day</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Good Eggs</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.totalGoodPieces.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">pieces in {days}d</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Daily Trend — Good vs Cracked</CardTitle>
          <CardDescription>Pieces recorded per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="good" stackId="a" fill="hsl(var(--success))" name="Good" />
                <Bar dataKey="cracked" stackId="a" fill="hsl(var(--destructive))" name="Cracked" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Crack rate over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Cracked Pieces / Day</CardTitle>
            <CardDescription>Trend of breakage volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="cracked" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cause Breakdown</CardTitle>
            <CardDescription>Cracked eggs grouped by reason</CardDescription>
          </CardHeader>
          <CardContent>
            {reasonBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No cracked eggs in this period</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reasonBreakdown} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
                      {reasonBreakdown.map((_, i) => <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Records table */}
      <Card>
        <CardHeader>
          <CardTitle>Cracked Egg Records</CardTitle>
          <CardDescription>{records.length} entries in the last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    <Egg className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No cracked eggs recorded — keep it up!
                  </TableCell>
                </TableRow>
              ) : paginated.map((r) => {
                const pcs = r.crates * PIECES_PER_CRATE + r.pieces;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium text-destructive">
                      {r.crates}c {r.pieces}p <span className="text-xs text-muted-foreground">({pcs} pcs)</span>
                    </TableCell>
                    <TableCell className="max-w-md">{r.crack_reason || "—"}</TableCell>
                    <TableCell>{r.profiles?.name || "Unknown"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            getPageNumbers={getPageNumbers}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CrackedEggsTab;
