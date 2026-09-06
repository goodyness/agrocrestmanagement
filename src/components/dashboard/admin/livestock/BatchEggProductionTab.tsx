import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { Egg, Plus, Layers, Sparkles, Loader2, TrendingDown, TrendingUp, AlertTriangle, Trash2, Coins, History } from "lucide-react";

const PIECES_PER_CRATE = 30;

interface Props {
  batch: any;
  onBatchUpdated?: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

export default function BatchEggProductionTab({ batch, onBatchUpdated }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [batchData, setBatchData] = useState<any>(batch);
  const [loading, setLoading] = useState(true);

  // one-time bird count confirmation
  const [askCount, setAskCount] = useState(false);
  const [countInput, setCountInput] = useState("");
  const [savingCount, setSavingCount] = useState(false);

  // single entry
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: today(), crates: "", pieces: "", cracked: "", notes: "" });
  const [saving, setSaving] = useState(false);

  // bulk entry
  const [showBulk, setShowBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState<any[]>([{ id: crypto.randomUUID(), date: today(), crates: "", pieces: "", cracked: "" }]);
  const [savingBulk, setSavingBulk] = useState(false);

  // AI
  const [ai, setAi] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");

  // pricing
  const [prices, setPrices] = useState<any[]>([]);
  const [showPrice, setShowPrice] = useState(false);
  const [priceForm, setPriceForm] = useState({ price: "", note: "" });
  const [savingPrice, setSavingPrice] = useState(false);
  const [spend, setSpend] = useState({ expenses: 0, purchase: 0 });

  const birds = Number(batchData?.current_quantity || 0);

  const currentPrice = prices.length ? Number(prices[0].price_per_crate) : 0;

  const fetchRows = async () => {
    const { data } = await supabase
      .from("batch_egg_production" as any)
      .select("*")
      .eq("batch_id", batch.id)
      .order("date", { ascending: true });
    setRows((data as any[]) || []);
    setLoading(false);
  };

  const fetchPrices = async () => {
    const { data } = await supabase
      .from("batch_egg_prices" as any)
      .select("*")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: false });
    setPrices((data as any[]) || []);
  };

  const fetchSpend = async () => {
    const { data: exp } = await supabase
      .from("miscellaneous_expenses")
      .select("amount")
      .eq("batch_id", batch.id);
    const expenses = (exp || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    setSpend({ expenses, purchase: Number((batchData as any)?.total_cost || 0) });
  };


  const refreshBatch = async () => {
    const { data } = await supabase.from("livestock_batches").select("*").eq("id", batch.id).maybeSingle();
    if (data) {
      setBatchData(data);
      if (!(data as any).bird_count_confirmed_at) {
        setCountInput(String((data as any).current_quantity ?? ""));
        setAskCount(true);
      }
    }
  };

  useEffect(() => {
    fetchRows();
    fetchPrices();
    refreshBatch();
  }, [batch.id]);

  useEffect(() => {
    fetchSpend();
  }, [batch.id, (batchData as any)?.total_cost]);

  const savePrice = async () => {
    const p = Number(priceForm.price);
    if (!Number.isFinite(p) || p <= 0) { toast.error("Enter a valid price per crate"); return; }
    setSavingPrice(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_egg_prices" as any).insert({
      batch_id: batch.id,
      price_per_crate: p,
      effective_from: today(),
      note: priceForm.note || null,
      created_by: user?.id ?? null,
    } as any);
    if (error) { setSavingPrice(false); toast.error("Could not save price"); return; }

    // Value any production days that were never priced (first price set covers
    // everything recorded so far). Already-valued days keep their old price.
    const unpriced = rows.filter((r) => r.price_per_crate === null || r.price_per_crate === undefined);
    for (const r of unpriced) {
      const totalPieces = Number(r.crates || 0) * PIECES_PER_CRATE + Number(r.pieces || 0);
      await supabase.from("batch_egg_production" as any)
        .update({ price_per_crate: p, egg_value: (totalPieces / PIECES_PER_CRATE) * p } as any)
        .eq("id", r.id);
    }

    setSavingPrice(false);
    toast.success(`Price set to ₦${p.toLocaleString()} per crate`);
    setShowPrice(false);
    setPriceForm({ price: "", note: "" });
    fetchPrices();
    fetchRows();
  };


  const confirmBirdCount = async () => {
    const n = parseInt(countInput);
    if (!Number.isFinite(n) || n < 0) { toast.error("Enter a valid number of birds"); return; }
    setSavingCount(true);
    // total mortality already recorded for this batch — keep it accounted for so
    // future mortality keeps deducting from the number the user just confirmed.
    const { data: morts } = await supabase.from("mortality_records").select("quantity_dead").eq("batch_id", batch.id);
    const deadTotal = (morts || []).reduce((s: number, m: any) => s + Number(m.quantity_dead || 0), 0);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("livestock_batches")
      .update({
        quantity: n + deadTotal,
        current_quantity: n,
        bird_count_confirmed_at: new Date().toISOString(),
        bird_count_confirmed_by: user?.id ?? null,
      } as any)
      .eq("id", batch.id);

    setSavingCount(false);
    if (error) { toast.error("Could not save bird count"); return; }
    toast.success(`Bird count set to ${n}`);
    setAskCount(false);
    await refreshBatch();
    onBatchUpdated?.();
  };

  const saveEntry = async () => {
    const crates = parseInt(form.crates) || 0;
    const pieces = parseInt(form.pieces) || 0;
    const cracked = parseInt(form.cracked) || 0;
    if (crates <= 0 && pieces <= 0 && cracked <= 0) { toast.error("Enter at least one egg figure"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_egg_production" as any).upsert({
      batch_id: batch.id,
      date: form.date,
      crates,
      pieces,
      cracked_pieces: cracked,
      birds_at_record: birds,
      notes: form.notes || null,
      price_per_crate: currentPrice || null,
      egg_value: currentPrice ? ((crates * PIECES_PER_CRATE + pieces) / PIECES_PER_CRATE) * currentPrice : null,
      recorded_by: user?.id ?? null,
      branch_id: batchData?.branch_id ?? null,
    } as any, { onConflict: "batch_id,date" });

    setSaving(false);
    if (error) { toast.error("Failed to save record"); return; }
    toast.success("Egg production recorded");
    setShowAdd(false);
    setForm({ date: today(), crates: "", pieces: "", cracked: "", notes: "" });
    fetchRows();
  };

  const saveBulk = async () => {
    const valid = bulkRows.filter((r) => (parseInt(r.crates) || 0) > 0 || (parseInt(r.pieces) || 0) > 0 || (parseInt(r.cracked) || 0) > 0);
    if (!valid.length) { toast.error("Add at least one row with eggs"); return; }
    const dates = new Set(valid.map((r) => r.date));
    if (dates.size !== valid.length) { toast.error("Duplicate dates in the list — one entry per date"); return; }
    setSavingBulk(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = valid.map((r) => {
      const crates = parseInt(r.crates) || 0;
      const pieces = parseInt(r.pieces) || 0;
      return {
        batch_id: batch.id,
        date: r.date,
        crates,
        pieces,
        cracked_pieces: parseInt(r.cracked) || 0,
        birds_at_record: birds,
        price_per_crate: currentPrice || null,
        egg_value: currentPrice ? ((crates * PIECES_PER_CRATE + pieces) / PIECES_PER_CRATE) * currentPrice : null,
        recorded_by: user?.id ?? null,
        branch_id: batchData?.branch_id ?? null,
      };
    });

    const { error } = await supabase.from("batch_egg_production" as any).upsert(payload as any, { onConflict: "batch_id,date" });
    setSavingBulk(false);
    if (error) { toast.error("Failed to save records"); return; }
    toast.success(`${payload.length} day(s) recorded`);
    setShowBulk(false);
    setBulkRows([{ id: crypto.randomUUID(), date: today(), crates: "", pieces: "", cracked: "" }]);
    fetchRows();
  };

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from("batch_egg_production" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Record deleted");
    fetchRows();
  };

  // ---- analytics ----
  const chartData = useMemo(() => rows.map((r) => {
    const total = Number(r.crates || 0) * PIECES_PER_CRATE + Number(r.pieces || 0);
    const b = Number(r.birds_at_record || birds) || 0;
    return {
      date: r.date,
      label: new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      total_eggs: total,
      cracked: Number(r.cracked_pieces || 0),
      lay_rate: b > 0 ? Number(((total / b) * 100).toFixed(1)) : 0,
    };
  }), [rows, birds]);

  const stats = useMemo(() => {
    const n = chartData.length;
    const totalEggs = chartData.reduce((s, r) => s + r.total_eggs, 0);
    const totalCracked = chartData.reduce((s, r) => s + r.cracked, 0);
    const avgDaily = n ? totalEggs / n : 0;
    const avgRate = n ? chartData.reduce((s, r) => s + r.lay_rate, 0) / n : 0;
    const last7 = chartData.slice(-7);
    const prev7 = chartData.slice(-14, -7);
    const last7Avg = last7.length ? last7.reduce((s, r) => s + r.total_eggs, 0) / last7.length : 0;
    const prev7Avg = prev7.length ? prev7.reduce((s, r) => s + r.total_eggs, 0) / prev7.length : 0;
    const change = prev7Avg > 0 ? ((last7Avg - prev7Avg) / prev7Avg) * 100 : 0;
    const currentRate = last7.length && birds > 0 ? (last7Avg / birds) * 100 : 0;
    return { n, totalEggs, totalCracked, avgDaily, avgRate, last7Avg, prev7Avg, change, currentRate };
  }, [chartData, birds]);

  // ---- valuation (independent of the Sales tab) ----
  const money = (n: number) =>
    `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const valuation = useMemo(() => {
    const totalPieces = rows.reduce((s, r) => s + Number(r.crates || 0) * PIECES_PER_CRATE + Number(r.pieces || 0), 0);
    const cracked = rows.reduce((s, r) => s + Number(r.cracked_pieces || 0), 0);
    const valued = rows.filter((r) => r.price_per_crate != null);
    const unvalued = rows.length - valued.length;
    const totalValue = rows.reduce((s, r) => s + Number(r.egg_value || 0), 0);
    const totalCost = Number(spend.expenses || 0) + Number(spend.purchase || 0);
    const recovery = totalCost > 0 ? Math.min((totalValue / totalCost) * 100, 100) : totalValue > 0 ? 100 : 0;
    return {
      totalPieces,
      crates: Math.floor(totalPieces / PIECES_PER_CRATE),
      looseEggs: totalPieces % PIECES_PER_CRATE,
      cracked,
      good: Math.max(totalPieces - cracked, 0),
      valuedDays: valued.length,
      unvalued,
      totalValue,
      totalCost,
      balance: totalValue - totalCost,
      recovery,
    };
  }, [rows, spend]);

  const priceHistory = useMemo(
    () => [...prices].reverse().map((p) => ({
      label: new Date(p.effective_from || p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      price: Number(p.price_per_crate),
    })),
    [prices]
  );

  const valueChart = useMemo(
    () => rows.filter((r) => Number(r.egg_value || 0) > 0).map((r) => ({
      label: new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      value: Number(r.egg_value || 0),
    })),
    [rows]
  );


  const weeklyData = useMemo(() => {
    const map = new Map<string, { week: string; eggs: number; days: number }>();
    chartData.forEach((r) => {
      const d = new Date(r.date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().split("T")[0];
      const e = map.get(key) || { week: new Date(key).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), eggs: 0, days: 0 };
      e.eggs += r.total_eggs; e.days += 1;
      map.set(key, e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({
      week: v.week, eggs: v.eggs, avg_per_day: Math.round(v.eggs / v.days),
    }));
  }, [chartData]);

  const declineAlert = stats.prev7Avg > 0 && stats.change <= -10;
  const lowRateAlert = stats.n >= 3 && birds > 0 && stats.currentRate < 50;

  const askAi = async () => {
    setAiLoading(true);
    setAi(null);
    try {
      const { data, error } = await supabase.functions.invoke("layer-production-advice", {
        body: {
          ageWeeks: batchData?.age_weeks,
          birds,
          avgLayRate: stats.avgRate.toFixed(1),
          last7Avg: Math.round(stats.last7Avg),
          prev7Avg: Math.round(stats.prev7Avg),
          recentRows: [...chartData].reverse().slice(0, 21),
          question: aiQuestion || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAi(data);
    } catch (e: any) {
      toast.error(e.message || "AI advisor unavailable");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* one-time bird count */}
      <Dialog open={askCount} onOpenChange={(v) => { if (!v && batchData?.bird_count_confirmed_at) setAskCount(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm current bird count</DialogTitle>
            <DialogDescription>
              Before tracking egg production we need the real number of birds in this batch right now.
              This is asked only once — it replaces the current record ({batchData?.current_quantity ?? 0} birds).
              From now on, recorded mortality is deducted automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Birds currently in this batch</Label>
            <Input type="number" min="0" value={countInput} onChange={(e) => setCountInput(e.target.value)} placeholder="e.g. 480" />
          </div>
          <DialogFooter>
            <Button onClick={confirmBirdCount} disabled={savingCount} className="w-full">
              {savingCount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save bird count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* alerts */}
      {declineAlert && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Production is declining</p>
              <p className="text-sm text-muted-foreground">
                Last 7 days average {Math.round(stats.last7Avg)} eggs/day vs {Math.round(stats.prev7Avg)} the week before
                ({stats.change.toFixed(1)}%). Check feed, water, lighting, heat stress and disease signs.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {lowRateAlert && !declineAlert && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-500">Lay rate below 50%</p>
              <p className="text-sm text-muted-foreground">
                Current lay rate is {stats.currentRate.toFixed(1)}% of {birds} birds. Healthy layers in peak should sit around 80–90%.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold">{birds}</p><p className="text-xs text-muted-foreground">Birds in batch</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold">{stats.totalEggs.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total eggs</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold">{Math.round(stats.avgDaily)}</p><p className="text-xs text-muted-foreground">Avg eggs/day</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold text-primary">{stats.currentRate.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Current lay rate</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className={`text-lg font-bold flex items-center justify-center gap-1 ${stats.change < 0 ? "text-destructive" : "text-success"}`}>
            {stats.change < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {stats.prev7Avg > 0 ? `${stats.change.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">7-day trend</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Record production</Button>
        <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}><Layers className="h-4 w-4 mr-1" /> Bulk entry</Button>
        <Button size="sm" variant="outline" onClick={() => { setPriceForm({ price: currentPrice ? String(currentPrice) : "", note: "" }); setShowPrice(true); }}>
          <Coins className="h-4 w-4 mr-1" /> {currentPrice ? "Update crate price" : "Set crate price"}
        </Button>

        {batchData?.bird_count_confirmed_at && (
          <Button size="sm" variant="ghost" onClick={() => { setCountInput(String(birds)); setAskCount(true); }}>
            Adjust bird count
          </Button>
        )}
      </div>

      {/* charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Daily eggs & lay rate</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} unit="%" />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine yAxisId="right" y={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "80% target", fontSize: 10 }} />
                  <Line yAxisId="left" type="monotone" dataKey="total_eggs" name="Eggs" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="lay_rate" name="Lay rate %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Weekly production</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="week" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="eggs" name="Eggs in week" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avg_per_day" name="Avg/day" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI advisor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI production advisor</CardTitle>
          <CardDescription>Get an expert read on this flock's laying trend and what to do next.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder="Optional: ask a specific question (e.g. why did production drop last week?)"
            className="h-16"
          />
          <Button size="sm" onClick={askAi} disabled={aiLoading || chartData.length === 0}>
            {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {aiLoading ? "Analysing..." : "Get AI advice"}
          </Button>
          {chartData.length === 0 && <p className="text-xs text-muted-foreground">Record a few days of production first.</p>}
          {ai && (
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge variant={ai.status === "critical" ? "destructive" : ai.status === "watch" ? "secondary" : "default"}>
                  {ai.status || "assessment"}
                </Badge>
                {ai.expected_lay_rate && <span className="text-xs text-muted-foreground">Expected: {ai.expected_lay_rate}</span>}
              </div>
              {ai.summary && <p className="text-sm">{ai.summary}</p>}
              {Array.isArray(ai.causes) && ai.causes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Likely causes</p>
                  <ul className="list-disc pl-5 text-sm space-y-0.5">{ai.causes.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
              {Array.isArray(ai.actions) && ai.actions.map((a: any, i: number) => (
                <div key={i} className="rounded-md border bg-background p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    <Badge variant={a.urgency === "critical" ? "destructive" : "outline"} className="text-[10px]">{a.urgency}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
                </div>
              ))}
              {ai.tip && <p className="text-xs text-muted-foreground italic">💡 {ai.tip}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* total eggs produced so far */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Egg className="h-4 w-4" /> All eggs produced so far</CardTitle>
          <CardDescription>Everything recorded for this batch since day one.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="text-center"><p className="text-lg font-bold">{valuation.totalPieces.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total eggs</p></div>
          <div className="text-center"><p className="text-lg font-bold">{valuation.crates.toLocaleString()}</p><p className="text-xs text-muted-foreground">Crates ({valuation.looseEggs} loose)</p></div>
          <div className="text-center"><p className="text-lg font-bold text-success">{valuation.good.toLocaleString()}</p><p className="text-xs text-muted-foreground">Good eggs</p></div>
          <div className="text-center"><p className="text-lg font-bold text-destructive">{valuation.cracked.toLocaleString()}</p><p className="text-xs text-muted-foreground">Cracked</p></div>
          <div className="text-center"><p className="text-lg font-bold text-primary">{money(valuation.totalValue)}</p><p className="text-xs text-muted-foreground">Value of eggs</p></div>
        </CardContent>
      </Card>

      {/* cost recovery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Coins className="h-4 w-4" /> Cost recovery on eggs</CardTitle>
          <CardDescription>
            Egg value at the prices set here versus what this batch has cost. This is separate from the Sales tab records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center"><p className="text-lg font-bold">{currentPrice ? money(currentPrice) : "—"}</p><p className="text-xs text-muted-foreground">Current price / crate</p></div>
            <div className="text-center"><p className="text-lg font-bold">{money(valuation.totalCost)}</p><p className="text-xs text-muted-foreground">Total cost (purchase + expenses)</p></div>
            <div className="text-center"><p className="text-lg font-bold text-primary">{money(valuation.totalValue)}</p><p className="text-xs text-muted-foreground">Egg value recorded</p></div>
            <div className="text-center">
              <p className={`text-lg font-bold ${valuation.balance >= 0 ? "text-success" : "text-destructive"}`}>
                {valuation.balance >= 0 ? `+${money(valuation.balance)}` : `-${money(Math.abs(valuation.balance))}`}
              </p>
              <p className="text-xs text-muted-foreground">{valuation.balance >= 0 ? "In profit" : "Still recovering"}</p>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${valuation.balance >= 0 ? "bg-success" : "bg-primary"}`} style={{ width: `${valuation.recovery}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{valuation.recovery.toFixed(1)}% of batch cost recovered from eggs.</p>
          {valuation.unvalued > 0 && (
            <p className="text-xs text-amber-600">
              {valuation.unvalued} recorded day(s) have no price yet — set a crate price and they will be valued.
            </p>
          )}
        </CardContent>
      </Card>

      {/* price history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Crate price history</CardTitle>
          <CardDescription>Changing the price only affects days recorded after the change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No price set yet for this batch.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Line type="stepAfter" dataKey="price" name="Price / crate" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={valueChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="value" name="Egg value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective from</TableHead>
                      <TableHead>Price / crate</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Set on</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {new Date(p.effective_from || p.created_at).toLocaleDateString("en-GB")}
                          {i === 0 && <Badge className="ml-2 text-[10px]">current</Badge>}
                        </TableCell>
                        <TableCell className="font-medium">{money(p.price_per_crate)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.note || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleString("en-GB")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* set price dialog */}
      <Dialog open={showPrice} onOpenChange={setShowPrice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentPrice ? "Update crate price" : "Set crate price"}</DialogTitle>
            <DialogDescription>
              Days already valued keep their old price. The first price you set also values every day recorded so far.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Price per crate (₦)</Label>
              <Input type="number" min="0" value={priceForm.price} onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })} placeholder="e.g. 4500" />
            </div>
            <div className="space-y-1">
              <Label>Reason / note (optional)</Label>
              <Textarea value={priceForm.note} onChange={(e) => setPriceForm({ ...priceForm, note: e.target.value })} className="h-16" placeholder="e.g. market price increase" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={savePrice} disabled={savingPrice} className="w-full">
              {savingPrice ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* records table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Egg className="h-4 w-4" /> Production records</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No egg production recorded for this batch yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Crates</TableHead>
                    <TableHead>Pieces</TableHead>
                    <TableHead>Total eggs</TableHead>
                    <TableHead>Cracked</TableHead>
                    <TableHead>Lay rate</TableHead>
                    <TableHead>Price/crate</TableHead>
                    <TableHead>Value</TableHead>

                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows].reverse().map((r) => {
                    const total = Number(r.crates || 0) * PIECES_PER_CRATE + Number(r.pieces || 0);
                    const b = Number(r.birds_at_record || birds) || 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{new Date(r.date).toLocaleDateString("en-GB")}</TableCell>
                        <TableCell>{r.crates}</TableCell>
                        <TableCell>{r.pieces}</TableCell>
                        <TableCell className="font-medium">{total}</TableCell>
                        <TableCell>{r.cracked_pieces || 0}</TableCell>
                        <TableCell>{b > 0 ? `${((total / b) * 100).toFixed(1)}%` : "—"}</TableCell>
                        <TableCell>{r.price_per_crate != null ? money(r.price_per_crate) : "—"}</TableCell>
                        <TableCell className="font-medium">{r.egg_value != null ? money(r.egg_value) : "—"}</TableCell>

                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => deleteRow(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* single entry dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record egg production</DialogTitle>
            <DialogDescription>1 crate = {PIECES_PER_CRATE} eggs. Re-entering a date updates that day.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Date</Label>
              <Input type="date" max={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label className="text-xs">Crates</Label>
                <Input type="number" min="0" value={form.crates} onChange={(e) => setForm({ ...form, crates: e.target.value })} placeholder="0" /></div>
              <div className="space-y-1"><Label className="text-xs">Pieces</Label>
                <Input type="number" min="0" value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} placeholder="0" /></div>
              <div className="space-y-1"><Label className="text-xs">Cracked</Label>
                <Input type="number" min="0" value={form.cracked} onChange={(e) => setForm({ ...form, cracked: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="space-y-1"><Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-16" /></div>
          </div>
          <DialogFooter>
            <Button onClick={saveEntry} disabled={saving} className="w-full">{saving ? "Saving..." : "Save record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* bulk entry dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk egg production entry</DialogTitle>
            <DialogDescription>Catch up on missed days — one row per date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {bulkRows.map((r, i) => (
              <div key={r.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end p-3 rounded-lg border bg-muted/30">
                <div className="space-y-1 col-span-2 sm:col-span-2"><Label className="text-xs">Date</Label>
                  <Input type="date" max={today()} value={r.date}
                    onChange={(e) => setBulkRows(bulkRows.map((x) => x.id === r.id ? { ...x, date: e.target.value } : x))} /></div>
                <div className="space-y-1"><Label className="text-xs">Crates</Label>
                  <Input type="number" min="0" value={r.crates}
                    onChange={(e) => setBulkRows(bulkRows.map((x) => x.id === r.id ? { ...x, crates: e.target.value } : x))} placeholder="0" /></div>
                <div className="space-y-1"><Label className="text-xs">Pieces</Label>
                  <Input type="number" min="0" value={r.pieces}
                    onChange={(e) => setBulkRows(bulkRows.map((x) => x.id === r.id ? { ...x, pieces: e.target.value } : x))} placeholder="0" /></div>
                <div className="flex gap-1 items-end">
                  <div className="space-y-1 flex-1"><Label className="text-xs">Cracked</Label>
                    <Input type="number" min="0" value={r.cracked}
                      onChange={(e) => setBulkRows(bulkRows.map((x) => x.id === r.id ? { ...x, cracked: e.target.value } : x))} placeholder="0" /></div>
                  {bulkRows.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => setBulkRows(bulkRows.filter((x) => x.id !== r.id))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full"
              onClick={() => setBulkRows([...bulkRows, { id: crypto.randomUUID(), date: today(), crates: "", pieces: "", cracked: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add another day
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={saveBulk} disabled={savingBulk} className="w-full">{savingBulk ? "Saving..." : "Save all entries"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
