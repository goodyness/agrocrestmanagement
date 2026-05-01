import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Egg, PawPrint, Plus, ClipboardCheck, History, RefreshCw,
  AlertTriangle, CheckCircle2, Download, Settings, TrendingUp, ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PIECES_PER_CRATE = 30;
const VARIANCE_THRESHOLD_KEY = "expected_stock_variance_threshold";
const DEFAULT_THRESHOLD = 10; // pieces or animals

type Baseline = {
  id: string;
  branch_id: string | null;
  item_type: "eggs" | "livestock";
  batch_id: string | null;
  crates: number;
  pieces: number;
  animal_count: number;
  baseline_at: string;
  notes: string | null;
  created_at: string;
};

type Recount = {
  id: string;
  branch_id: string | null;
  item_type: string;
  batch_id: string | null;
  baseline_id?: string | null;
  recount_at: string;
  actual_crates: number;
  actual_pieces: number;
  actual_animal_count: number;
  expected_crates: number;
  expected_pieces: number;
  expected_animal_count: number;
  variance_pieces: number;
  variance_animals: number;
  notes: string | null;
};

type Batch = {
  id: string;
  species: string;
  species_type: string | null;
  current_quantity: number;
  branch_id: string | null;
  date_acquired: string;
};

const toPieces = (crates: number, pieces: number) => crates * PIECES_PER_CRATE + pieces;
const fromPieces = (total: number) => ({
  crates: Math.floor(total / PIECES_PER_CRATE),
  pieces: total % PIECES_PER_CRATE,
});

// CSV helper
const toCsv = (rows: Record<string, any>[]) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
};

const downloadFile = (content: string | Blob, filename: string, type = "text/csv") => {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function ExpectedStockTab() {
  const { currentBranchId } = useBranch();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [recounts, setRecounts] = useState<Recount[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [mortality, setMortality] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [baselineOpen, setBaselineOpen] = useState(false);
  const [recountOpen, setRecountOpen] = useState(false);
  const [recountTarget, setRecountTarget] = useState<{ type: "eggs" | "livestock"; batchId?: string; label: string } | null>(null);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  const [threshold, setThreshold] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(VARIANCE_THRESHOLD_KEY) : null;
    return v ? parseInt(v) || DEFAULT_THRESHOLD : DEFAULT_THRESHOLD;
  });

  // ----- Admin gate (defense in depth; RLS also enforces) -----
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(!!data);
    })();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [b, r, bt, p, s, m] = await Promise.all([
        supabase.from("stock_baselines").select("*").order("baseline_at", { ascending: false }),
        supabase.from("stock_recounts").select("*").order("recount_at", { ascending: false }),
        supabase.from("livestock_batches").select("id, species, species_type, current_quantity, branch_id, date_acquired").eq("is_active", true),
        supabase.from("daily_production").select("date, crates, pieces, branch_id, created_at"),
        supabase.from("sales_records").select("date, product_type, quantity, unit, branch_id, created_at"),
        supabase.from("mortality_records").select("date, batch_id, quantity_dead, branch_id, created_at"),
      ]);
      setBaselines((b.data as Baseline[]) || []);
      setRecounts((r.data as Recount[]) || []);
      setBatches((bt.data as Batch[]) || []);
      setProduction(p.data || []);
      setSales(s.data || []);
      setMortality(m.data || []);
    } catch (e: any) {
      toast.error("Failed to load stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const branchFilter = (row: any) =>
    !currentBranchId || row.branch_id === currentBranchId || row.branch_id === null;

  // ---- EGGS expected calc (current) ----
  const eggBaseline = useMemo(
    () => baselines
      .filter((b) => b.item_type === "eggs" && branchFilter(b))
      .sort((a, b) => new Date(b.baseline_at).getTime() - new Date(a.baseline_at).getTime())[0],
    [baselines, currentBranchId]
  );

  const expectedEggs = useMemo(() => {
    if (!eggBaseline) return null;
    const baselineTime = new Date(eggBaseline.baseline_at).getTime();
    let total = toPieces(eggBaseline.crates, eggBaseline.pieces);
    production.filter(branchFilter).forEach((p) => {
      const t = new Date(p.created_at || p.date).getTime();
      if (t >= baselineTime) total += toPieces(p.crates || 0, p.pieces || 0);
    });
    sales.filter(branchFilter).forEach((s) => {
      const t = new Date(s.created_at || s.date).getTime();
      if (t >= baselineTime && (s.product_type || "").toLowerCase().includes("egg")) {
        const qty = Number(s.quantity) || 0;
        const unit = (s.unit || "").toLowerCase();
        if (unit.includes("crate")) total -= qty * PIECES_PER_CRATE;
        else total -= qty;
      }
    });
    return Math.max(total, 0);
  }, [eggBaseline, production, sales, currentBranchId]);

  // ---- LIVESTOCK per-batch expected ----
  const visibleBatches = useMemo(
    () => batches.filter((b) => !currentBranchId || b.branch_id === currentBranchId),
    [batches, currentBranchId]
  );

  const livestockExpected = useMemo(() => {
    return visibleBatches.map((batch) => {
      const baseline = baselines
        .filter((b) => b.item_type === "livestock" && b.batch_id === batch.id)
        .sort((a, b) => new Date(b.baseline_at).getTime() - new Date(a.baseline_at).getTime())[0];

      if (!baseline) return { batch, baseline: null, expected: null };

      const baselineTime = new Date(baseline.baseline_at).getTime();
      let total = baseline.animal_count;

      mortality.forEach((m) => {
        if (m.batch_id !== batch.id) return;
        const t = new Date(m.created_at || m.date).getTime();
        if (t >= baselineTime) total -= m.quantity_dead || 0;
      });

      sales.filter(branchFilter).forEach((s) => {
        const t = new Date(s.created_at || s.date).getTime();
        const ptype = (s.product_type || "").toLowerCase();
        if (t >= baselineTime && ptype.includes(batch.species.toLowerCase()) && !ptype.includes("egg")) {
          total -= Number(s.quantity) || 0;
        }
      });

      return { batch, baseline, expected: Math.max(total, 0) };
    });
  }, [visibleBatches, baselines, mortality, sales, currentBranchId]);

  // ---- TIME SERIES: build daily expected series for chart ----
  const eggSeries = useMemo(() => {
    if (!eggBaseline) return [];
    const baselineTime = new Date(eggBaseline.baseline_at).getTime();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startDay = new Date(eggBaseline.baseline_at);
    startDay.setHours(0, 0, 0, 0);
    const days = Math.min(60, Math.max(1, Math.ceil((now - startDay.getTime()) / dayMs) + 1));

    // Pre-compute movements
    const moves: { t: number; delta: number }[] = [];
    production.filter(branchFilter).forEach((p) => {
      const t = new Date(p.created_at || p.date).getTime();
      if (t >= baselineTime) moves.push({ t, delta: toPieces(p.crates || 0, p.pieces || 0) });
    });
    sales.filter(branchFilter).forEach((s) => {
      const t = new Date(s.created_at || s.date).getTime();
      if (t >= baselineTime && (s.product_type || "").toLowerCase().includes("egg")) {
        const qty = Number(s.quantity) || 0;
        const unit = (s.unit || "").toLowerCase();
        const pcs = unit.includes("crate") ? qty * PIECES_PER_CRATE : qty;
        moves.push({ t, delta: -pcs });
      }
    });

    const series: { date: string; expected: number }[] = [];
    for (let i = 0; i < days; i++) {
      const dayEnd = startDay.getTime() + (i + 1) * dayMs;
      let total = toPieces(eggBaseline.crates, eggBaseline.pieces);
      moves.forEach((m) => { if (m.t <= dayEnd) total += m.delta; });
      series.push({ date: format(new Date(startDay.getTime() + i * dayMs), "MMM d"), expected: Math.max(total, 0) });
    }
    return series;
  }, [eggBaseline, production, sales, currentBranchId]);

  const livestockSeries = useMemo(() => {
    return livestockExpected
      .filter((x) => x.baseline)
      .map(({ batch, baseline }) => {
        const baselineTime = new Date(baseline!.baseline_at).getTime();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const startDay = new Date(baseline!.baseline_at);
        startDay.setHours(0, 0, 0, 0);
        const days = Math.min(60, Math.max(1, Math.ceil((now - startDay.getTime()) / dayMs) + 1));

        const moves: { t: number; delta: number }[] = [];
        mortality.forEach((m) => {
          if (m.batch_id !== batch.id) return;
          const t = new Date(m.created_at || m.date).getTime();
          if (t >= baselineTime) moves.push({ t, delta: -(m.quantity_dead || 0) });
        });
        sales.filter(branchFilter).forEach((s) => {
          const t = new Date(s.created_at || s.date).getTime();
          const ptype = (s.product_type || "").toLowerCase();
          if (t >= baselineTime && ptype.includes(batch.species.toLowerCase()) && !ptype.includes("egg")) {
            moves.push({ t, delta: -(Number(s.quantity) || 0) });
          }
        });

        const series: { date: string; expected: number }[] = [];
        for (let i = 0; i < days; i++) {
          const dayEnd = startDay.getTime() + (i + 1) * dayMs;
          let total = baseline!.animal_count;
          moves.forEach((m) => { if (m.t <= dayEnd) total += m.delta; });
          series.push({ date: format(new Date(startDay.getTime() + i * dayMs), "MMM d"), expected: Math.max(total, 0) });
        }
        return { batch, series };
      });
  }, [livestockExpected, mortality, sales, currentBranchId]);

  // ---- VARIANCE ALERTS ----
  const varianceAlerts = useMemo(() => {
    return recounts
      .filter(branchFilter)
      .filter((r) => {
        const v = r.item_type === "eggs" ? Math.abs(r.variance_pieces) : Math.abs(r.variance_animals);
        return v > threshold;
      })
      .slice(0, 10);
  }, [recounts, threshold, currentBranchId]);

  // ---- EXPORT helpers ----
  const exportCsv = (which: "baselines" | "recounts") => {
    if (which === "baselines") {
      const rows = baselines.filter(branchFilter).map((b) => {
        const batch = batches.find((bt) => bt.id === b.batch_id);
        return {
          baseline_at: format(new Date(b.baseline_at), "yyyy-MM-dd HH:mm"),
          item_type: b.item_type,
          item: b.item_type === "eggs" ? "Eggs" : (batch?.species || "Livestock"),
          crates: b.crates,
          pieces: b.pieces,
          animal_count: b.animal_count,
          notes: b.notes || "",
        };
      });
      downloadFile(toCsv(rows), `baselines-${format(new Date(), "yyyyMMdd")}.csv`);
    } else {
      const rows = recounts.filter(branchFilter).map((r) => {
        const batch = batches.find((bt) => bt.id === r.batch_id);
        const isEgg = r.item_type === "eggs";
        return {
          recount_at: format(new Date(r.recount_at), "yyyy-MM-dd HH:mm"),
          item: isEgg ? "Eggs" : (batch?.species || "Livestock"),
          expected: isEgg ? `${r.expected_crates}c ${r.expected_pieces}p` : r.expected_animal_count,
          actual: isEgg ? `${r.actual_crates}c ${r.actual_pieces}p` : r.actual_animal_count,
          variance: isEgg ? r.variance_pieces : r.variance_animals,
          notes: r.notes || "",
        };
      });
      downloadFile(toCsv(rows), `recounts-${format(new Date(), "yyyyMMdd")}.csv`);
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Expected Stock — Audit Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated ${format(new Date(), "PPp")}`, 14, 22);

    const baseRows = baselines.filter(branchFilter).map((b) => {
      const batch = batches.find((bt) => bt.id === b.batch_id);
      return [
        format(new Date(b.baseline_at), "yyyy-MM-dd HH:mm"),
        b.item_type === "eggs" ? "Eggs" : (batch?.species || "Livestock"),
        b.item_type === "eggs" ? `${b.crates}c ${b.pieces}p` : `${b.animal_count} animals`,
        b.notes || "",
      ];
    });
    autoTable(doc, {
      startY: 28,
      head: [["When", "Item", "Quantity", "Notes"]],
      body: baseRows,
      headStyles: { fillColor: [60, 90, 60] },
      didDrawPage: (d) => {
        doc.setFontSize(12);
        doc.text("Baselines", 14, d.cursor!.y - baseRows.length * 7 - 8);
      },
    });

    const recRows = recounts.filter(branchFilter).map((r) => {
      const batch = batches.find((bt) => bt.id === r.batch_id);
      const isEgg = r.item_type === "eggs";
      return [
        format(new Date(r.recount_at), "yyyy-MM-dd HH:mm"),
        isEgg ? "Eggs" : (batch?.species || "Livestock"),
        isEgg ? `${r.expected_crates}c ${r.expected_pieces}p` : String(r.expected_animal_count),
        isEgg ? `${r.actual_crates}c ${r.actual_pieces}p` : String(r.actual_animal_count),
        String(isEgg ? r.variance_pieces : r.variance_animals),
        r.notes || "",
      ];
    });
    const lastY = (doc as any).lastAutoTable.finalY || 40;
    doc.setFontSize(12);
    doc.text("Recounts", 14, lastY + 10);
    autoTable(doc, {
      startY: lastY + 14,
      head: [["When", "Item", "Expected", "Actual", "Variance", "Notes"]],
      body: recRows,
      headStyles: { fillColor: [60, 90, 60] },
    });

    doc.save(`stock-audit-${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  // ---- ADMIN GATE ----
  if (isAdmin === false) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">Admins only</p>
          <p className="text-sm text-muted-foreground">Expected Stock management is restricted to administrators.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Expected Stock at Farm</h2>
          <p className="text-sm text-muted-foreground">
            Baseline + live movements. Production/intake adds, sales/mortality subtracts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setThresholdOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Alert Threshold ({threshold})
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCsv("baselines")}>Baselines (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv("recounts")}>Recounts (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf}>Full Audit (PDF)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setBaselineOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Baseline
          </Button>
        </div>
      </div>

      {/* Variance Alerts */}
      {varianceAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{varianceAlerts.length} variance alert{varianceAlerts.length > 1 ? "s" : ""} above threshold ({threshold})</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {varianceAlerts.map((r) => {
                const isEgg = r.item_type === "eggs";
                const v = isEgg ? r.variance_pieces : r.variance_animals;
                const batch = batches.find((bt) => bt.id === r.batch_id);
                return (
                  <li key={r.id}>
                    <strong>{isEgg ? "Eggs" : (batch?.species || "Livestock")}</strong>
                    {" — variance "}{v > 0 ? `+${v}` : v}
                    {" on "}{format(new Date(r.recount_at), "PPp")}
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current">Current Stock</TabsTrigger>
          <TabsTrigger value="trend">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trend
          </TabsTrigger>
          <TabsTrigger value="baselines">
            <History className="h-4 w-4 mr-2" />
            Baselines
          </TabsTrigger>
          <TabsTrigger value="recounts">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Recounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Egg className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Eggs</CardTitle>
                  <CardDescription>
                    {eggBaseline
                      ? `Baseline set ${format(new Date(eggBaseline.baseline_at), "PPp")}`
                      : "No baseline set yet"}
                  </CardDescription>
                </div>
              </div>
              {eggBaseline && (
                <Button size="sm" variant="outline" onClick={() => {
                  setRecountTarget({ type: "eggs", label: "Eggs" });
                  setRecountOpen(true);
                }}>
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Physical Recount
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {expectedEggs === null ? (
                <p className="text-sm text-muted-foreground">Create a baseline to start tracking eggs at farm.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat label="Expected Crates" value={fromPieces(expectedEggs).crates} />
                  <Stat label="Expected Pieces" value={fromPieces(expectedEggs).pieces} />
                  <Stat label="Total Pieces" value={expectedEggs} />
                  <Stat label="Baseline" value={`${eggBaseline!.crates}c ${eggBaseline!.pieces}p`} small />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <PawPrint className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Livestock by Batch</CardTitle>
                  <CardDescription>Live expected count per active batch</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {visibleBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active batches.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead>Expected Now</TableHead>
                      <TableHead>System Quantity</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {livestockExpected.map(({ batch, baseline, expected }) => (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <div className="font-medium capitalize">{batch.species}</div>
                          <div className="text-xs text-muted-foreground">{batch.species_type}</div>
                        </TableCell>
                        <TableCell>
                          {baseline ? (
                            <div className="text-sm">
                              <div>{baseline.animal_count}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(baseline.baseline_at), "PP p")}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline">No baseline</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {expected !== null ? <span className="font-bold text-lg">{expected}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{batch.current_quantity}</TableCell>
                        <TableCell className="text-right">
                          {baseline && (
                            <Button size="sm" variant="outline" onClick={() => {
                              setRecountTarget({ type: "livestock", batchId: batch.id, label: `${batch.species} batch` });
                              setRecountOpen(true);
                            }}>
                              Recount
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TREND tab */}
        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eggs — Expected Stock Over Time</CardTitle>
              <CardDescription>From most recent baseline (pieces)</CardDescription>
            </CardHeader>
            <CardContent>
              {eggSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No baseline yet.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <LineChart data={eggSeries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="expected" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Expected pieces" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {livestockSeries.map(({ batch, series }) => (
            <Card key={batch.id}>
              <CardHeader>
                <CardTitle className="capitalize">{batch.species} {batch.species_type ? `(${batch.species_type})` : ""}</CardTitle>
                <CardDescription>Expected animal count over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="expected" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Expected animals" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ))}
          {livestockSeries.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No livestock baselines yet — create one to see trend.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="baselines">
          <Card>
            <CardHeader>
              <CardTitle>Baseline History</CardTitle>
              <CardDescription>All baselines ever recorded</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baselines.filter(branchFilter).map((b) => {
                    const batch = batches.find((bt) => bt.id === b.batch_id);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm">{format(new Date(b.baseline_at), "PPp")}</TableCell>
                        <TableCell>
                          {b.item_type === "eggs" ? (
                            <Badge>Eggs</Badge>
                          ) : (
                            <Badge variant="secondary" className="capitalize">{batch?.species || "Livestock"}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {b.item_type === "eggs" ? `${b.crates} crates ${b.pieces} pieces` : `${b.animal_count} animals`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{b.notes || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recounts">
          <Card>
            <CardHeader>
              <CardTitle>Physical Recounts</CardTitle>
              <CardDescription>Variance between actual physical count and expected</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recounts.filter(branchFilter).map((r) => {
                    const isEgg = r.item_type === "eggs";
                    const variance = isEgg ? r.variance_pieces : r.variance_animals;
                    const batch = batches.find((bt) => bt.id === r.batch_id);
                    const overThreshold = Math.abs(variance) > threshold;
                    return (
                      <TableRow key={r.id} className={overThreshold ? "bg-destructive/5" : ""}>
                        <TableCell className="text-sm">{format(new Date(r.recount_at), "PPp")}</TableCell>
                        <TableCell>
                          {isEgg ? <Badge>Eggs</Badge> : <Badge variant="secondary" className="capitalize">{batch?.species || "Livestock"}</Badge>}
                        </TableCell>
                        <TableCell>{isEgg ? `${r.expected_crates}c ${r.expected_pieces}p` : r.expected_animal_count}</TableCell>
                        <TableCell>{isEgg ? `${r.actual_crates}c ${r.actual_pieces}p` : r.actual_animal_count}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 font-medium ${variance === 0 ? "text-green-600" : overThreshold ? "text-destructive" : "text-amber-600"}`}>
                            {variance === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            {variance > 0 ? `+${variance}` : variance}
                            {overThreshold && <Badge variant="destructive" className="ml-1">over</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewBaselineDialog
        open={baselineOpen}
        onOpenChange={setBaselineOpen}
        batches={visibleBatches}
        branchId={currentBranchId}
        onCreated={loadAll}
      />

      <RecountDialog
        open={recountOpen}
        onOpenChange={setRecountOpen}
        target={recountTarget}
        expectedEggs={expectedEggs}
        livestockExpected={livestockExpected}
        eggBaseline={eggBaseline}
        branchId={currentBranchId}
        onCreated={loadAll}
      />

      <ThresholdDialog
        open={thresholdOpen}
        onOpenChange={setThresholdOpen}
        threshold={threshold}
        onSave={(v) => {
          setThreshold(v);
          localStorage.setItem(VARIANCE_THRESHOLD_KEY, String(v));
          toast.success(`Alert threshold set to ${v}`);
        }}
      />
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border p-3 bg-muted/30">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={small ? "text-lg font-semibold" : "text-2xl font-bold"}>{value}</div>
    </div>
  );
}

function ThresholdDialog({
  open, onOpenChange, threshold, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  threshold: number;
  onSave: (v: number) => void;
}) {
  const [v, setV] = useState(String(threshold));
  useEffect(() => { if (open) setV(String(threshold)); }, [open, threshold]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Variance Alert Threshold</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Trigger an alert when |actual − expected| exceeds:</Label>
          <Input type="number" min="0" value={v} onChange={(e) => setV(e.target.value)} />
          <p className="text-xs text-muted-foreground">Applies to eggs (pieces) and livestock (animals).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => {
            const n = Math.max(0, parseInt(v) || 0);
            onSave(n);
            onOpenChange(false);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewBaselineDialog({
  open, onOpenChange, batches, branchId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batches: Batch[];
  branchId: string | null;
  onCreated: () => void;
}) {
  const [itemType, setItemType] = useState<"eggs" | "livestock">("eggs");
  const [batchId, setBatchId] = useState("");
  const [crates, setCrates] = useState("0");
  const [pieces, setPieces] = useState("0");
  const [animals, setAnimals] = useState("0");
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });
  const [saving, setSaving] = useState(false);

  // Validation: pieces must be 0..29 (else roll into crates)
  const piecesNum = parseInt(pieces);
  const cratesNum = parseInt(crates);
  const piecesInvalid = !isNaN(piecesNum) && (piecesNum < 0 || piecesNum >= PIECES_PER_CRATE);
  const cratesInvalid = !isNaN(cratesNum) && cratesNum < 0;
  const animalsNum = parseInt(animals);
  const animalsInvalid = !isNaN(animalsNum) && animalsNum < 0;

  const submit = async () => {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");

      const payload: any = {
        branch_id: branchId,
        item_type: itemType,
        baseline_at: new Date(when).toISOString(),
        notes: notes || null,
        created_by: userRes.user.id,
      };
      if (itemType === "eggs") {
        const c = Math.max(0, parseInt(crates) || 0);
        const p = Math.max(0, parseInt(pieces) || 0);
        if (p >= PIECES_PER_CRATE) {
          toast.error(`Pieces must be 0–${PIECES_PER_CRATE - 1}. Roll extras into crates.`);
          setSaving(false); return;
        }
        payload.crates = c;
        payload.pieces = p;
      } else {
        if (!batchId) { toast.error("Select a batch"); setSaving(false); return; }
        const a = parseInt(animals);
        if (isNaN(a) || a < 0) { toast.error("Animal count cannot be negative"); setSaving(false); return; }
        payload.batch_id = batchId;
        payload.animal_count = a;
      }
      const { error } = await supabase.from("stock_baselines").insert(payload);
      if (error) throw error;
      toast.success("Baseline saved");
      onOpenChange(false);
      onCreated();
      setCrates("0"); setPieces("0"); setAnimals("0"); setNotes(""); setBatchId("");
    } catch (e: any) {
      toast.error(e.message || "Failed to save baseline");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Stock Baseline</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Item Type</Label>
            <Select value={itemType} onValueChange={(v: any) => setItemType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="eggs">Eggs</SelectItem>
                <SelectItem value="livestock">Livestock (per batch)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {itemType === "eggs" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Crates</Label>
                <Input type="number" min="0" value={crates} onChange={(e) => setCrates(e.target.value)} />
                {cratesInvalid && <p className="text-xs text-destructive mt-1">Cannot be negative</p>}
              </div>
              <div>
                <Label>Pieces (0–{PIECES_PER_CRATE - 1})</Label>
                <Input type="number" min="0" max={PIECES_PER_CRATE - 1} value={pieces} onChange={(e) => setPieces(e.target.value)} />
                {piecesInvalid && <p className="text-xs text-destructive mt-1">Must be 0–{PIECES_PER_CRATE - 1}</p>}
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label>Batch</Label>
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.species} {b.species_type ? `(${b.species_type})` : ""} — qty {b.current_quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Animal count</Label>
                <Input type="number" min="0" value={animals} onChange={(e) => setAnimals(e.target.value)} />
                {animalsInvalid && <p className="text-xs text-destructive mt-1">Cannot be negative</p>}
              </div>
            </>
          )}

          <div>
            <Label>Date & Time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || piecesInvalid || cratesInvalid || animalsInvalid}>
            {saving ? "Saving..." : "Save Baseline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecountDialog({
  open, onOpenChange, target, expectedEggs, livestockExpected, eggBaseline, branchId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: { type: "eggs" | "livestock"; batchId?: string; label: string } | null;
  expectedEggs: number | null;
  livestockExpected: { batch: Batch; baseline: Baseline | null; expected: number | null }[];
  eggBaseline: Baseline | undefined;
  branchId: string | null;
  onCreated: () => void;
}) {
  const [actualCrates, setActualCrates] = useState("0");
  const [actualPieces, setActualPieces] = useState("0");
  const [actualAnimals, setActualAnimals] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setActualCrates("0"); setActualPieces("0"); setActualAnimals("0"); setNotes("");
    }
  }, [open]);

  if (!target) return null;

  const cratesNum = parseInt(actualCrates);
  const piecesNum = parseInt(actualPieces);
  const animalsNum = parseInt(actualAnimals);
  const cratesInvalid = !isNaN(cratesNum) && cratesNum < 0;
  const piecesInvalid = !isNaN(piecesNum) && (piecesNum < 0 || piecesNum >= PIECES_PER_CRATE);
  const animalsInvalid = !isNaN(animalsNum) && animalsNum < 0;

  const submit = async () => {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");

      const payload: any = {
        branch_id: branchId,
        item_type: target.type,
        recount_at: new Date().toISOString(),
        notes: notes || null,
        recorded_by: userRes.user.id,
      };

      if (target.type === "eggs") {
        const c = Math.max(0, parseInt(actualCrates) || 0);
        const p = parseInt(actualPieces) || 0;
        if (p < 0 || p >= PIECES_PER_CRATE) {
          toast.error(`Pieces must be 0–${PIECES_PER_CRATE - 1}.`);
          setSaving(false); return;
        }
        const expectedTotal = expectedEggs || 0;
        const expected = fromPieces(expectedTotal);
        const actualTotal = toPieces(c, p);
        payload.actual_crates = c;
        payload.actual_pieces = p;
        payload.expected_crates = expected.crates;
        payload.expected_pieces = expected.pieces;
        payload.variance_pieces = actualTotal - expectedTotal;
        payload.baseline_id = eggBaseline?.id || null;
      } else {
        const a = parseInt(actualAnimals);
        if (isNaN(a) || a < 0) { toast.error("Actual count cannot be negative"); setSaving(false); return; }
        const ls = livestockExpected.find((x) => x.batch.id === target.batchId);
        const expected = ls?.expected || 0;
        payload.batch_id = target.batchId;
        payload.actual_animal_count = a;
        payload.expected_animal_count = expected;
        payload.variance_animals = a - expected;
        payload.baseline_id = ls?.baseline?.id || null;
      }

      const { error } = await supabase.from("stock_recounts").insert(payload);
      if (error) throw error;
      toast.success("Recount saved");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Failed to save recount");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Physical Recount — {target.label}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {target.type === "eggs" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Expected now: <strong>{expectedEggs !== null ? `${fromPieces(expectedEggs).crates} crates ${fromPieces(expectedEggs).pieces} pieces` : "—"}</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Actual Crates</Label>
                  <Input type="number" min="0" value={actualCrates} onChange={(e) => setActualCrates(e.target.value)} />
                  {cratesInvalid && <p className="text-xs text-destructive mt-1">Cannot be negative</p>}
                </div>
                <div>
                  <Label>Actual Pieces (0–{PIECES_PER_CRATE - 1})</Label>
                  <Input type="number" min="0" max={PIECES_PER_CRATE - 1} value={actualPieces} onChange={(e) => setActualPieces(e.target.value)} />
                  {piecesInvalid && <p className="text-xs text-destructive mt-1">Must be 0–{PIECES_PER_CRATE - 1}</p>}
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Expected now: <strong>{livestockExpected.find((x) => x.batch.id === target.batchId)?.expected ?? "—"}</strong>
              </p>
              <div>
                <Label>Actual count</Label>
                <Input type="number" min="0" value={actualAnimals} onChange={(e) => setActualAnimals(e.target.value)} />
                {animalsInvalid && <p className="text-xs text-destructive mt-1">Cannot be negative</p>}
              </div>
            </>
          )}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || cratesInvalid || piecesInvalid || animalsInvalid}>
            {saving ? "Saving..." : "Save Recount"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
