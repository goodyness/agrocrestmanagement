import { useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays, parseISO, addDays, isAfter, isBefore } from "date-fns";
import { CalendarIcon, Plus, TrendingUp, TrendingDown, Trash2, Wallet, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/activityLogger";

const PIECES_PER_CRATE = 30;

interface Batch {
  id: string;
  species: string;
  species_type: string | null;
  stage: string | null;
  current_quantity: number;
  branch_id: string | null;
  livestock_category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  branch_id: string | null;
}

interface Monitor {
  id: string;
  name: string;
  batch_id: string | null;
  branch_id: string | null;
  livestock_category_id: string | null;
  bird_count: number;
  bags_per_day: number;
  price_per_bag: number;
  fallback_price_per_crate: number;
  fallback_price_per_piece: number;
  start_date: string;
  end_date: string;
  baseline_crates: number;
  baseline_pieces: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: "",
  batch_id: "none",
  livestock_category_id: "none",
  bird_count: "",
  bags_per_day: "1.5",
  price_per_bag: "15300",
  fallback_price_per_crate: "",
  fallback_price_per_piece: "",
  start_date: new Date(),
  end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  baseline_crates: "0",
  baseline_pieces: "0",
  notes: "",
};

export default function ExpectedProfitTab() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [recounts, setRecounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(!!data);
    })();
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [m, b, c, p, s, e, sb, sr] = await Promise.all([
      supabase.from("profit_monitors").select("*").order("created_at", { ascending: false }),
      supabase.from("livestock_batches").select("id, species, species_type, stage, current_quantity, branch_id, livestock_category_id").eq("is_active", true),
      supabase.from("livestock_categories").select("id, name, branch_id"),
      supabase.from("daily_production").select("date, crates, pieces, branch_id"),
      supabase.from("sales_records").select("date, product_type, quantity, unit, total_amount, price_per_unit, branch_id"),
      supabase.from("miscellaneous_expenses").select("date, amount, branch_id, batch_id, expense_type"),
      supabase.from("stock_baselines").select("baseline_at, crates, pieces, branch_id, item_type").eq("item_type", "eggs"),
      supabase.from("stock_recounts").select("recount_at, actual_crates, actual_pieces, branch_id, item_type").eq("item_type", "eggs"),
    ]);
    setMonitors((m.data as Monitor[]) || []);
    setBatches((b.data as Batch[]) || []);
    setCategories((c.data as Category[]) || []);
    setProduction(p.data || []);
    setSales(s.data || []);
    setExpenses(e.data || []);
    setBaselines(sb.data || []);
    setRecounts(sr.data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const bird = parseInt(form.bird_count);
    const bags = parseFloat(form.bags_per_day);
    const ppb = parseFloat(form.price_per_bag);
    const fpc = parseFloat(form.fallback_price_per_crate || "0");
    const fpp = parseFloat(form.fallback_price_per_piece || "0");
    const bcr = parseInt(form.baseline_crates || "0");
    const bpc = parseInt(form.baseline_pieces || "0");

    if (isNaN(bird) || bird < 0) return toast.error("Invalid bird count");
    if (isNaN(bags) || bags < 0) return toast.error("Invalid bags/day");
    if (isNaN(ppb) || ppb < 0) return toast.error("Invalid price per bag");
    if (fpc < 0 || fpp < 0) return toast.error("Fallback prices cannot be negative");
    if (bpc < 0 || bpc >= PIECES_PER_CRATE) return toast.error("Baseline pieces must be 0–29");
    if (bcr < 0) return toast.error("Baseline crates cannot be negative");
    if (form.end_date <= form.start_date) return toast.error("End date must be after start");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Not authenticated");

    const batch = batches.find((b) => b.id === form.batch_id);

    const payload = {
      name: form.name.trim(),
      batch_id: form.batch_id === "none" ? null : form.batch_id,
      branch_id: batch?.branch_id ?? null,
      livestock_category_id:
        form.livestock_category_id === "none"
          ? batch?.livestock_category_id ?? null
          : form.livestock_category_id,
      bird_count: bird,
      bags_per_day: bags,
      price_per_bag: ppb,
      fallback_price_per_crate: fpc,
      fallback_price_per_piece: fpp,
      start_date: format(form.start_date, "yyyy-MM-dd"),
      end_date: format(form.end_date, "yyyy-MM-dd"),
      baseline_crates: bcr,
      baseline_pieces: bpc,
      notes: form.notes.trim() || null,
      created_by: user.id,
    };

    const { data, error } = await supabase.from("profit_monitors").insert([payload]).select().single();
    if (error) return toast.error(error.message);

    await logActivity("create", "profit_monitor", data.id, { name: payload.name }, payload.branch_id);
    toast.success("Profit monitor created");
    setOpen(false);
    setForm(emptyForm);
    loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this profit monitor?")) return;
    const { error } = await supabase.from("profit_monitors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "profit_monitor", id);
    toast.success("Deleted");
    loadAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Expected Profit
          </h2>
          <p className="text-sm text-muted-foreground">
            Track feed cost vs egg revenue & expenses to see live profit per batch.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> New Profit Monitor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Profit Monitor</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="e.g. Layers Batch A — May–June"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Linked Batch (optional)</Label>
                  <Select
                    value={form.batch_id}
                    onValueChange={(v) => {
                      const b = batches.find((x) => x.id === v);
                      setForm({
                        ...form,
                        batch_id: v,
                        bird_count: b ? String(b.current_quantity) : form.bird_count,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.species}{b.species_type ? ` (${b.species_type})` : ""} • {b.current_quantity} birds
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Animal Category (optional)</Label>
                  <Select
                    value={form.livestock_category_id}
                    onValueChange={(v) => setForm({ ...form, livestock_category_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="From batch" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— From batch —</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Number of Laying Birds *</Label>
                  <Input type="number" min={0} value={form.bird_count}
                    onChange={(e) => setForm({ ...form, bird_count: e.target.value })} />
                </div>
                <div>
                  <Label>Bags of Feed per Day *</Label>
                  <Input type="number" min={0} step="0.1" value={form.bags_per_day}
                    onChange={(e) => setForm({ ...form, bags_per_day: e.target.value })} />
                </div>

                <div>
                  <Label>Price per Bag (₦) *</Label>
                  <Input type="number" min={0} value={form.price_per_bag}
                    onChange={(e) => setForm({ ...form, price_per_bag: e.target.value })} />
                </div>
                <div>
                  <Label>Fallback Price per Crate (₦)</Label>
                  <Input type="number" min={0} value={form.fallback_price_per_crate}
                    onChange={(e) => setForm({ ...form, fallback_price_per_crate: e.target.value })}
                    placeholder="Used when no sale recorded" />
                </div>
                <div>
                  <Label>Fallback Price per Piece (₦)</Label>
                  <Input type="number" min={0} value={form.fallback_price_per_piece}
                    onChange={(e) => setForm({ ...form, fallback_price_per_piece: e.target.value })}
                    placeholder="Used when no sale recorded" />
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(form.start_date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.start_date}
                        onSelect={(d) => d && setForm({ ...form, start_date: d })}
                        initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(form.end_date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.end_date}
                        onSelect={(d) => d && setForm({ ...form, end_date: d })}
                        initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Baseline Eggs — Crates</Label>
                  <Input type="number" min={0} value={form.baseline_crates}
                    onChange={(e) => setForm({ ...form, baseline_crates: e.target.value })} />
                </div>
                <div>
                  <Label>Baseline Eggs — Pieces (0–29)</Label>
                  <Input type="number" min={0} max={29} value={form.baseline_pieces}
                    onChange={(e) => setForm({ ...form, baseline_pieces: e.target.value })} />
                </div>

                <div className="md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : monitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No profit monitors yet. {isAdmin && "Click \"New Profit Monitor\" to start tracking."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {monitors.map((m) => (
            <MonitorCard
              key={m.id}
              monitor={m}
              production={production}
              sales={sales}
              expenses={expenses}
              baselines={baselines}
              recounts={recounts}
              onDelete={isAdmin ? () => handleDelete(m.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MonitorCard({
  monitor,
  production,
  sales,
  expenses,
  baselines,
  recounts,
  onDelete,
}: {
  monitor: Monitor;
  production: any[];
  sales: any[];
  expenses: any[];
  baselines: any[];
  recounts: any[];
  onDelete?: () => void;
}) {
  const [showDaily, setShowDaily] = useState(false);
  const stats = useMemo(() => {
    const start = parseISO(monitor.start_date);
    const end = parseISO(monitor.end_date);
    const today = new Date();
    const periodEnd = today < end ? today : end;
    const daysElapsed = Math.max(1, differenceInCalendarDays(periodEnd, start) + 1);
    const totalDays = differenceInCalendarDays(end, start) + 1;

    const inBranch = (b: string | null) =>
      !monitor.branch_id || b === monitor.branch_id;

    // Determine effective starting stock: latest stock_baseline or stock_recount at-or-before start_date.
    // Falls back to the monitor's manually entered baseline if none found.
    const anchorEvents: { at: Date; pieces: number; kind: string }[] = [];
    for (const sb of baselines) {
      if (!inBranch(sb.branch_id)) continue;
      anchorEvents.push({
        at: new Date(sb.baseline_at),
        pieces: (sb.crates || 0) * PIECES_PER_CRATE + (sb.pieces || 0),
        kind: "baseline",
      });
    }
    for (const rc of recounts) {
      if (!inBranch(rc.branch_id)) continue;
      anchorEvents.push({
        at: new Date(rc.recount_at),
        pieces: (rc.actual_crates || 0) * PIECES_PER_CRATE + (rc.actual_pieces || 0),
        kind: "recount",
      });
    }
    const startEnd = addDays(start, 1); // anchor must be strictly before the day after start
    const eligibleAnchors = anchorEvents
      .filter((a) => a.at < startEnd)
      .sort((a, b) => b.at.getTime() - a.at.getTime());
    const anchor = eligibleAnchors[0] || null;

    const monitorBaselinePieces =
      monitor.baseline_crates * PIECES_PER_CRATE + monitor.baseline_pieces;
    const startingPieces = anchor ? anchor.pieces : monitorBaselinePieces;
    // Production filter starts from anchor date (or start_date if no anchor)
    const accumulationStart = anchor ? anchor.at : start;
    const inProdRange = (d: string) => {
      const dt = parseISO(d);
      return dt >= accumulationStart && dt <= periodEnd;
    };

    // Eggs produced since anchor
    const prod = production.filter((p) => inProdRange(p.date) && inBranch(p.branch_id));
    const producedSinceAnchor = prod.reduce(
      (s, p) => s + (p.crates || 0) * PIECES_PER_CRATE + (p.pieces || 0),
      0
    );
    const totalProducedPieces = startingPieces + producedSinceAnchor;
    const inRange = (d: string) => {
      const dt = parseISO(d);
      return dt >= start && dt <= periodEnd;
    };

    // Egg sales (revenue + qty sold)
    const eggSales = sales.filter(
      (s) => inRange(s.date) && inBranch(s.branch_id) && /egg/i.test(s.product_type || "")
    );
    let revenueFromSales = 0;
    let soldPieces = 0;
    for (const s of eggSales) {
      revenueFromSales += Number(s.total_amount || 0);
      const q = Number(s.quantity || 0);
      const u = (s.unit || "").toLowerCase();
      if (u.includes("crate")) soldPieces += q * PIECES_PER_CRATE;
      else soldPieces += q;
    }

    // Unsold eggs valued at fallback
    const unsoldPieces = Math.max(totalProducedPieces - soldPieces, 0);
    const fallbackPerPiece =
      monitor.fallback_price_per_piece > 0
        ? monitor.fallback_price_per_piece
        : monitor.fallback_price_per_crate / PIECES_PER_CRATE;
    const revenueFromUnsold = unsoldPieces * fallbackPerPiece;
    const totalRevenue = revenueFromSales + revenueFromUnsold;

    // Costs: feed (bags/day * price * days) + miscellaneous expenses in period
    const feedCost = monitor.bags_per_day * monitor.price_per_bag * daysElapsed;
    const projectedFeedCost = monitor.bags_per_day * monitor.price_per_bag * totalDays;

    const periodExpenses = expenses
      .filter((e) => inRange(e.date) && inBranch(e.branch_id))
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const totalCost = feedCost + periodExpenses;
    const profit = totalRevenue - totalCost;
    const profitPerDay = profit / daysElapsed;

    return {
      daysElapsed,
      totalDays,
      totalProducedPieces,
      startingPieces,
      producedSinceAnchor,
      anchor,
      soldPieces,
      unsoldPieces,
      revenueFromSales,
      revenueFromUnsold,
      totalRevenue,
      feedCost,
      projectedFeedCost,
      periodExpenses,
      totalCost,
      profit,
      profitPerDay,
      fallbackPerPiece,
    };
  }, [monitor, production, sales, expenses, baselines, recounts]);

  // Daily trend series: expected (linear projection) vs actual (cumulative real revenue/cost/profit)
  const trend = useMemo(() => {
    const start = parseISO(monitor.start_date);
    const end = parseISO(monitor.end_date);
    const totalDays = differenceInCalendarDays(end, start) + 1;
    const today = new Date();
    const fallbackPerPiece =
      monitor.fallback_price_per_piece > 0
        ? monitor.fallback_price_per_piece
        : monitor.fallback_price_per_crate / PIECES_PER_CRATE;

    const inBranch = (b: string | null) => !monitor.branch_id || b === monitor.branch_id;

    // Pre-bucket data by day
    const prodByDay = new Map<string, number>();
    for (const p of production) {
      if (!inBranch(p.branch_id)) continue;
      const key = p.date;
      prodByDay.set(key, (prodByDay.get(key) || 0) + (p.crates || 0) * PIECES_PER_CRATE + (p.pieces || 0));
    }
    const salesByDay = new Map<string, { revenue: number; pieces: number }>();
    for (const s of sales) {
      if (!inBranch(s.branch_id)) continue;
      if (!/egg/i.test(s.product_type || "")) continue;
      const key = s.date;
      const cur = salesByDay.get(key) || { revenue: 0, pieces: 0 };
      cur.revenue += Number(s.total_amount || 0);
      const q = Number(s.quantity || 0);
      const u = (s.unit || "").toLowerCase();
      cur.pieces += u.includes("crate") ? q * PIECES_PER_CRATE : q;
      salesByDay.set(key, cur);
    }
    const expByDay = new Map<string, number>();
    for (const e of expenses) {
      if (!inBranch(e.branch_id)) continue;
      expByDay.set(e.date, (expByDay.get(e.date) || 0) + Number(e.amount || 0));
    }

    const dailyFeed = monitor.bags_per_day * monitor.price_per_bag;
    const totalProjectedRevenue =
      stats.totalRevenue + (stats.profitPerDay >= 0 ? 0 : 0); // not used; expected is linear below
    // Expected revenue is unknown; use linear projection of current actual rate, or just feed-cost line.
    // We'll plot: actual cumulative revenue, cumulative cost, cumulative profit, plus expected break-even line.

    let cumRev = 0;
    let cumCost = 0;
    let cumPiecesProduced = stats.startingPieces;
    let cumPiecesSold = 0;
    const data: Array<{
      date: string;
      day: number;
      revenue: number;
      cost: number;
      profit: number;
      expectedCost: number;
    }> = [];

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(start, i);
      if (isAfter(d, today)) {
        // future days: only show expected cost line
        data.push({
          date: format(d, "MMM d"),
          day: i + 1,
          revenue: NaN as any,
          cost: NaN as any,
          profit: NaN as any,
          expectedCost: dailyFeed * (i + 1),
        });
        continue;
      }
      const key = format(d, "yyyy-MM-dd");
      cumPiecesProduced += prodByDay.get(key) || 0;
      const sd = salesByDay.get(key);
      if (sd) {
        cumRev += sd.revenue;
        cumPiecesSold += sd.pieces;
      }
      cumCost += dailyFeed + (expByDay.get(key) || 0);
      const unsold = Math.max(cumPiecesProduced - cumPiecesSold, 0);
      const revWithUnsold = cumRev + unsold * fallbackPerPiece;
      data.push({
        date: format(d, "MMM d"),
        dateKey: key,
        day: i + 1,
        revenue: Math.round(revWithUnsold),
        cost: Math.round(cumCost),
        profit: Math.round(revWithUnsold - cumCost),
        expectedCost: Math.round(dailyFeed * (i + 1)),
        salesRev: sd?.revenue || 0,
        salesPieces: sd?.pieces || 0,
        producedPieces: prodByDay.get(key) || 0,
        unsoldPieces: unsold,
        unsoldValue: Math.round(unsold * fallbackPerPiece),
        feedCost: dailyFeed,
        miscExpenses: expByDay.get(key) || 0,
        dayProfit: Math.round((sd?.revenue || 0) - dailyFeed - (expByDay.get(key) || 0)),
      } as any);
    }
    return data;
  }, [monitor, production, sales, expenses, stats]);

  const fmt = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const eggsDisplay = (pieces: number) =>
    `${Math.floor(pieces / PIECES_PER_CRATE)} crates ${pieces % PIECES_PER_CRATE} pcs`;

  const isProfit = stats.profit >= 0;
  const eggSalesPct = stats.totalRevenue > 0 ? (stats.revenueFromSales / stats.totalRevenue) * 100 : 0;
  const feedPct = stats.totalCost > 0 ? (stats.feedCost / stats.totalCost) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{monitor.name}</CardTitle>
            <CardDescription>
              {format(parseISO(monitor.start_date), "MMM d")} – {format(parseISO(monitor.end_date), "MMM d, yyyy")}
              {" · "}{monitor.bird_count} birds · {monitor.bags_per_day} bag/day
              {stats.anchor && (
                <span className="block text-[10px] mt-0.5">
                  Anchored to {stats.anchor.kind} of {eggsDisplay(stats.startingPieces)} on {format(stats.anchor.at, "MMM d")}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isProfit ? "default" : "destructive"} className="text-sm">
              {isProfit ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {fmt(stats.profit)}
            </Badge>
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-green-500/10 p-2 border border-green-500/20">
            <div className="text-xs text-muted-foreground">Total Revenue</div>
            <div className="font-semibold text-green-700 dark:text-green-400">{fmt(stats.totalRevenue)}</div>
          </div>
          <div className="rounded-md bg-red-500/10 p-2 border border-red-500/20">
            <div className="text-xs text-muted-foreground">Total Cost</div>
            <div className="font-semibold text-red-700 dark:text-red-400">{fmt(stats.totalCost)}</div>
          </div>
        </div>

        {/* Revenue breakdown */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue Breakdown</div>
          <div className="h-2 rounded-full overflow-hidden bg-muted flex">
            <div className="bg-green-500" style={{ width: `${eggSalesPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${100 - eggSalesPct}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Egg Sales: <strong>{fmt(stats.revenueFromSales)}</strong> ({eggsDisplay(stats.soldPieces)})
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Unsold @ fallback: <strong>{fmt(stats.revenueFromUnsold)}</strong> ({eggsDisplay(stats.unsoldPieces)})
            </span>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost Breakdown</div>
          <div className="h-2 rounded-full overflow-hidden bg-muted flex">
            <div className="bg-orange-500" style={{ width: `${feedPct}%` }} />
            <div className="bg-rose-500" style={{ width: `${100 - feedPct}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Feed: <strong>{fmt(stats.feedCost)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Misc Expenses: <strong>{fmt(stats.periodExpenses)}</strong>
            </span>
          </div>
        </div>

        {/* Trend chart */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Profit Trend ({stats.daysElapsed} of {stats.totalDays} days)
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any) => (typeof v === "number" ? fmt(v) : "—")}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(142 76% 36%)" name="Revenue" dot={false} strokeWidth={2} connectNulls={false} />
                <Line type="monotone" dataKey="cost" stroke="hsl(0 84% 55%)" name="Cost" dot={false} strokeWidth={2} connectNulls={false} />
                <Line type="monotone" dataKey="profit" stroke="hsl(217 91% 55%)" name="Profit" dot={false} strokeWidth={2} connectNulls={false} />
                <Line type="monotone" dataKey="expectedCost" stroke="hsl(25 95% 53%)" name="Expected Cost" dot={false} strokeDasharray="4 4" strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collapsible daily breakdown */}
        <Collapsible open={showDaily} onOpenChange={setShowDaily}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Daily Breakdown
              </span>
              {showDaily ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-h-72 overflow-auto rounded border mt-1">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Date</th>
                    <th className="px-2 py-1 font-medium text-right">Sales</th>
                    <th className="px-2 py-1 font-medium text-right">Unsold@FB</th>
                    <th className="px-2 py-1 font-medium text-right">Feed</th>
                    <th className="px-2 py-1 font-medium text-right">Misc</th>
                    <th className="px-2 py-1 font-medium text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {trend
                    .filter((d: any) => !Number.isNaN(d.revenue))
                    .map((d: any) => (
                      <tr key={d.dateKey} className="border-t">
                        <td className="px-2 py-1 whitespace-nowrap">{d.date}</td>
                        <td className="px-2 py-1 text-right text-green-700 dark:text-green-400">
                          {fmt(d.salesRev)}
                        </td>
                        <td className="px-2 py-1 text-right text-amber-600">
                          {fmt(d.unsoldValue)}
                        </td>
                        <td className="px-2 py-1 text-right text-orange-600">{fmt(d.feedCost)}</td>
                        <td className="px-2 py-1 text-right text-rose-600">{fmt(d.miscExpenses)}</td>
                        <td
                          className={cn(
                            "px-2 py-1 text-right font-medium",
                            d.dayProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"
                          )}
                        >
                          {fmt(d.dayProfit)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 px-1">
              Profit per day = sales revenue − feed cost − misc expenses (excludes fallback unsold value).
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Footer KPIs */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Eggs Produced</div>
            <div className="text-xs font-semibold">{eggsDisplay(stats.totalProducedPieces)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Avg/Day</div>
            <div className={cn("text-xs font-semibold", stats.profitPerDay >= 0 ? "text-green-600" : "text-destructive")}>
              {fmt(stats.profitPerDay)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Projected Feed</div>
            <div className="text-xs font-semibold">{fmt(stats.projectedFeedCost)}</div>
          </div>
        </div>

        {monitor.notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 pl-2">{monitor.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
