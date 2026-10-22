import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { toast } from "sonner";
import { Wheat, Trash2, Pencil, Sparkles, Info, AlertTriangle, CheckCircle, TrendingUp, Download, History } from "lucide-react";
import { exportToCSV } from "@/lib/exportUtils";
import { User } from "@supabase/supabase-js";

interface Props { batch: any; user?: User | null }

const PIECES_PER_CRATE = 30;
const TARGET_EGG_MASS_FCR = 2.1; // kg feed per kg of egg mass for layers

const money = (n: number | null | undefined) =>
  `₦${Math.round(Number(n || 0)).toLocaleString()}`;
const shortDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Expected layer feed intake in g/bird/day by flock age
function expectedLayerFeedG(ageWeeks: number): number {
  const a = Number(ageWeeks) || 0;
  if (a < 8) return Math.min(20 + a * 6, 68);
  if (a < 12) return 68 + (a - 8) * 4;
  if (a < 16) return 84 + (a - 12) * 3.5;
  if (a < 18) return 98 + (a - 16) * 2;
  if (a < 22) return 102 + (a - 18) * 3;
  if (a < 40) return 115;
  return 110;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};
const mondayOf = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
};

export default function BatchFeedIntakeTab({ batch, user }: Props) {
  const batchId = batch?.id;
  const birds = Number(batch?.current_quantity || 0);
  const [feedRows, setFeedRows] = useState<any[]>([]);
  const [prodRows, setProdRows] = useState<any[]>([]);
  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillDismissed, setBackfillDismissed] = useState(
    () => localStorage.getItem(`fi_backfill_dismissed_${batch?.id}`) === "1"
  );

  const [settings, setSettings] = useState({
    bagSize: 25,
    pricePerBag: Number(localStorage.getItem(`fi_bag_${batch?.id}`)) || 0,
    avgEggWeightG: Number(localStorage.getItem(`fi_eggW_${batch?.id}`)) || 62,
  });
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    kg: "",
    pricePerBag: "",
    notes: "",
  });
  const [backfill, setBackfill] = useState({ mode: "avg", kgPerDay: "", totalKg: "" });

  const load = async () => {
    if (!batchId) return;
    const [f, p, e] = await Promise.all([
      supabase.from("batch_feed_intake").select("*").eq("batch_id", batchId).order("date", { ascending: false }),
      supabase.from("batch_egg_production").select("date, crates, pieces, cracked_pieces, price_per_crate, egg_value").eq("batch_id", batchId).order("date", { ascending: true }),
      supabase.from("miscellaneous_expenses").select("id, date, amount, expense_type, description, created_by, profiles:created_by(name)").eq("batch_id", batchId).order("date", { ascending: false }),
    ]);
    setFeedRows(f.data || []);
    setProdRows(p.data || []);
    setExpenseRows(e.data || []);
    const lastPrice = (f.data || []).find((r: any) => Number(r.price_per_bag) > 0);
    if (lastPrice) {
      const p2 = Number(lastPrice.price_per_bag);
      setSettings((s) => ({ ...s, pricePerBag: s.pricePerBag || p2 }));
      setForm((fm) => ({ ...fm, pricePerBag: fm.pricePerBag || String(p2) }));
    }
  };
  useEffect(() => { load(); }, [batchId]);

  // Only batch expenses whose TYPE is Feed are excluded (feed cost comes from the daily rate)
  const isFeedExpense = (r: any) => String(r.expense_type || "").trim().toLowerCase().includes("feed");
  const nonFeedExpenses = useMemo(() => expenseRows.filter((r) => !isFeedExpense(r)), [expenseRows]);
  const expenseByDate = useMemo(() => {
    const m: Record<string, number> = {};
    nonFeedExpenses.forEach((r) => { m[r.date] = (m[r.date] || 0) + Number(r.amount || 0); });
    return m;
  }, [nonFeedExpenses]);

  const eggPriceByDate = useMemo(() => {
    const priceEvents = prodRows
      .filter((r: any) => Number(r.price_per_crate || 0) > 0)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    return (d: string) => {
      let price = 0;
      for (const ev of priceEvents) { if (ev.date <= d) price = Number(ev.price_per_crate); else break; }
      return price;
    };
  }, [prodRows]);

  // Feed rates sorted oldest → newest; each applies from its date until the next one
  const ratesAsc = useMemo(() => [...feedRows].sort((a: any, b: any) => a.date.localeCompare(b.date)), [feedRows]);
  const rateFor = (d: string) => {
    let r: any = null;
    for (const x of ratesAsc) { if (x.date <= d) r = x; else break; }
    return r;
  };

  // Per-day economics: every production date + every calendar day covered by a feed rate (up to today)
  const daily = useMemo(() => {
    const dates = new Set<string>(prodRows.map((r: any) => r.date));
    Object.keys(expenseByDate).forEach((d) => { if (ratesAsc.length && d >= ratesAsc[0].date) dates.add(d); });
    if (ratesAsc.length) {
      const end = today();
      for (let d = ratesAsc[0].date; d <= end; d = addDays(d, 1)) dates.add(d);
    }
    const sorted = [...dates].filter((d) => d <= today()).sort((a, b) => a.localeCompare(b));
    return sorted.map((d) => {
      const rate = rateFor(d);
      const prod = prodRows.find((r: any) => r.date === d);
      const eggs = prod ? Number(prod.crates) * PIECES_PER_CRATE + Number(prod.pieces) : 0;
      const cratePrice = prod?.price_per_crate != null ? Number(prod.price_per_crate) : eggPriceByDate(d);
      const eggRevenue = prod?.egg_value != null ? Number(prod.egg_value) : eggs * (cratePrice / PIECES_PER_CRATE);
      const feedKg = rate ? Number(rate.kg_consumed || 0) : 0;
      const feedCost = rate ? (feedKg / Number(rate.bag_size_kg || 25)) * Number(rate.price_per_bag || 0) : 0;
      const otherExp = expenseByDate[d] || 0;
      const net = eggRevenue - feedCost - otherExp;
      return {
        date: d, eggs, cratePrice, eggRevenue, feedCost, otherExp, net, feedKg,
        gPerBird: feedKg && birds > 0 ? (feedKg * 1000) / birds : 0,
      };
    });
  }, [ratesAsc, prodRows, expenseByDate, eggPriceByDate, birds]);

  const weekly = useMemo(() => {
    const m: Record<string, any> = {};
    daily.forEach((d) => {
      const w = mondayOf(d.date);
      m[w] = m[w] || { week: w, eggs: 0, eggRevenue: 0, feedCost: 0, otherExp: 0, net: 0, feedKg: 0, gBirdSum: 0, gBirdDays: 0 };
      m[w].eggs += d.eggs; m[w].eggRevenue += d.eggRevenue; m[w].feedCost += d.feedCost;
      m[w].otherExp += d.otherExp; m[w].net += d.net; m[w].feedKg += d.feedKg;
      if (d.gPerBird > 0) { m[w].gBirdSum += d.gPerBird; m[w].gBirdDays += 1; }
    });
    return Object.values(m).sort((a: any, b: any) => a.week.localeCompare(b.week)).map((w: any) => {
      const eggMassKg = (w.eggs * settings.avgEggWeightG) / 1000;
      return { ...w, fcr: eggMassKg > 0 ? w.feedKg / eggMassKg : null, gPerBird: w.gBirdDays ? w.gBirdSum / w.gBirdDays : 0 };
    });
  }, [daily, settings.avgEggWeightG]);

  const monthly = useMemo(() => {
    const m: Record<string, any> = {};
    daily.forEach((d) => {
      const mo = d.date.slice(0, 7);
      m[mo] = m[mo] || { month: mo, eggs: 0, eggRevenue: 0, feedCost: 0, otherExp: 0, net: 0, feedKg: 0 };
      m[mo].eggs += d.eggs; m[mo].eggRevenue += d.eggRevenue; m[mo].feedCost += d.feedCost;
      m[mo].otherExp += d.otherExp; m[mo].net += d.net; m[mo].feedKg += d.feedKg;
    });
    return Object.values(m).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [daily]);

  const last30 = daily.filter((d) => d.date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const totals = useMemo(() => {
    const eggRevenue = daily.reduce((s, d) => s + d.eggRevenue, 0);
    const feedCost = daily.reduce((s, d) => s + d.feedCost, 0);
    const otherExp = daily.reduce((s, d) => s + d.otherExp, 0);
    const net = eggRevenue - feedCost - otherExp;
    const feedKg = daily.reduce((s, d) => s + d.feedKg, 0);
    const eggs = daily.reduce((s, d) => s + d.eggs, 0);
    const eggMassKg = (eggs * settings.avgEggWeightG) / 1000;
    return {
      eggRevenue, feedCost, otherExp, net, feedKg, eggs,
      fcr: eggMassKg > 0 ? feedKg / eggMassKg : null,
      profitPerDay: daily.length ? net / daily.length : 0,
      profitPerWeek: daily.length ? (net / daily.length) * 7 : 0,
      profitPerMonth: daily.length ? (net / daily.length) * 30 : 0,
      feedShare: eggRevenue > 0 ? (feedCost / eggRevenue) * 100 : 0,
    };
  }, [daily, settings.avgEggWeightG]);

  // ---- Feeding intelligence ----
  const intelligence = useMemo(() => {
    const age = Number(batch?.age_weeks || 0);
    const expected = expectedLayerFeedG(age);
    const recent = daily.filter((d) => d.gPerBird > 0).slice(-7);
    const actual = recent.length ? recent.reduce((s, d) => s + d.gPerBird, 0) / recent.length : 0;
    const ratio = expected > 0 ? actual / expected : 0;
    const advice: { level: "good" | "warn" | "bad"; text: string }[] = [];
    let status: "well_fed" | "underfed" | "overfed" | "no_data" = "no_data";

    if (actual === 0) {
      advice.push({ level: "warn", text: "No recent feed intake entries. Record daily feed (kg) so the system can judge whether the flock is underfed or well fed." });
    } else if (ratio < 0.9) {
      status = "underfed";
      advice.push({ level: "bad", text: `Flock is eating ~${Math.round(actual)}g/bird/day vs ~${expected}g expected at ${age} weeks — that is ${Math.round((1 - ratio) * 100)}% under. Underfeeding reduces lay rate within days; check feeder space, feed availability and whether birds are finishing troughs early.` });
    } else if (ratio > 1.12) {
      status = "overfed";
      advice.push({ level: "warn", text: `Intake is ~${Math.round(actual)}g/bird/day vs ~${expected}g expected (${Math.round((ratio - 1) * 100)}% above). Check for feed wastage, spillage or overweight birds; excess feed raises cost per egg without raising output.` });
    } else {
      status = "well_fed";
      advice.push({ level: "good", text: `Feed intake looks right: ~${Math.round(actual)}g/bird/day against ~${expected}g expected at ${age} weeks.` });
    }

    if (totals.fcr != null) {
      if (totals.fcr > TARGET_EGG_MASS_FCR * 1.2) {
        advice.push({ level: "bad", text: `Feed conversion is ${totals.fcr.toFixed(2)} kg feed per kg of eggs (target ≈ ${TARGET_EGG_MASS_FCR}). Poor FCR usually means low-quality feed, heat stress, disease or too many non-laying birds. Review feed quality and lay rate.` });
      } else if (totals.fcr <= TARGET_EGG_MASS_FCR * 0.85) {
        advice.push({ level: "good", text: `Excellent feed conversion (${totals.fcr.toFixed(2)}). The flock is turning feed into eggs efficiently — keep this feed and routine.` });
      } else {
        advice.push({ level: "good", text: `Feed conversion ${totals.fcr.toFixed(2)} kg/kg of eggs is within a normal layer range (target ≈ ${TARGET_EGG_MASS_FCR}).` });
      }
    }

    if (totals.eggRevenue > 0 && totals.feedShare > 75) {
      advice.push({ level: "warn", text: `Feed is eating ${Math.round(totals.feedShare)}% of egg revenue. Above ~75% the margin is very thin — negotiate feed price per bag or review waste.` });
    }
    const recentProd = prodRows.slice(-7);
    const prevProd = prodRows.slice(-14, -7);
    const avg = (a: any[]) => a.length ? a.reduce((s: number, r: any) => s + Number(r.crates) * PIECES_PER_CRATE + Number(r.pieces), 0) / a.length : 0;
    if (avg(prevProd) > 0) {
      const change = ((avg(recentProd) - avg(prevProd)) / avg(prevProd)) * 100;
      if (change < -8) advice.push({ level: "bad", text: `Egg output dropped ~${Math.abs(Math.round(change))}% in the last 7 days vs the week before. Rule out feed quantity/quality change first, then water, lighting hours and disease.` });
      else if (change > 5) advice.push({ level: "good", text: `Egg output is trending up (+${Math.round(change)}% week over week).` });
    }
    if (totals.net < 0 && daily.length >= 7) {
      const costCovered = totals.eggRevenue > 0 ? Math.round(((totals.feedCost + totals.otherExp) / totals.eggRevenue) * 100) : 0;
      advice.push({ level: "warn", text: `Net position is still negative (${money(totals.net)}). Egg revenue has covered ${costCovered}% of running costs so far — profit begins once costs are fully covered.` });
    }
    return { actual, expected, ratio, status, advice };
  }, [daily, prodRows, batch?.age_weeks, totals]);

  // ---- Actions ----
  const saveEntry = async () => {
    const kg = parseFloat(form.kg);
    const price = parseFloat(form.pricePerBag);
    if (!form.date) return toast.error("Pick the start date for this rate");
    if (!kg || kg <= 0) return toast.error("Enter the kg of feed the flock eats per day");
    if (!price || price <= 0) return toast.error("Enter the price per bag — it is used to compute feed cost");
    setSaving(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    const payload: any = {
      batch_id: batchId,
      branch_id: batch?.branch_id || null,
      date: form.date,
      kg_consumed: kg,
      bag_size_kg: settings.bagSize,
      price_per_bag: price,
      birds_at_record: birds || null,
      notes: form.notes?.slice(0, 500) || null,
      recorded_by: u?.id || null,
    };
    // A rate is keyed by its start date; earlier rates are never modified.
    const { error } = await supabase.from("batch_feed_intake").upsert(payload, { onConflict: "batch_id,date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Feed rate saved — applies from ${form.date} until changed`);
    setForm({ date: today(), kg: "", pricePerBag: String(price), notes: "" });
    setSettings((s) => ({ ...s, pricePerBag: price }));
    load();
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("batch_feed_intake").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rate removed");
    load();
  };

  const chartData = last30.map((d) => ({
    date: shortDate(d.date),
    "Egg revenue": Math.round(d.eggRevenue),
    "Feed cost": Math.round(d.feedCost),
    "Other expenses": Math.round(d.otherExp),
    "Net profit": Math.round(d.net),
  }));

  const currentRate = feedRows[0] || null;
  const todayRow = daily.find((d) => d.date === today());
  const firstProdDate: string | null = prodRows[0]?.date || null;
  const firstRateDate: string | null = feedRows.length ? feedRows[feedRows.length - 1].date : null;
  const needsBackfill = !!firstProdDate && (!firstRateDate || firstRateDate > firstProdDate) && !backfillDismissed && feedRows.length > 0;

  const statusBadge = intelligence.status === "well_fed"
    ? { label: "Fed well", cls: "default" as const }
    : intelligence.status === "underfed"
      ? { label: "Underfed", cls: "destructive" as const }
      : intelligence.status === "overfed"
        ? { label: "Possible overfeeding", cls: "destructive" as const }
        : { label: "No recent data", cls: "secondary" as const };

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Stat label="All-time profit" value={money(totals.net)} accent={totals.net >= 0 ? "text-primary" : "text-destructive"} sub={`${daily.length} day(s) tracked`} />
        <Stat label="Profit today" value={money(todayRow?.net || 0)} accent={(todayRow?.net || 0) >= 0 ? "text-primary" : "text-destructive"} />
        <Stat label="Avg profit / day" value={money(totals.profitPerDay)} sub={`wk ${money(totals.profitPerWeek)} · mo ${money(totals.profitPerMonth)}`} />
        <Stat label="Egg revenue (all time)" value={money(totals.eggRevenue)} />
        <Stat label="Feed cost (all time)" value={money(totals.feedCost)} />
        <Stat label="Other batch expenses" value={money(totals.otherExp)} sub="excludes Feed type" />
      </div>

      {/* Feed rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            <Wheat className="h-4 w-4 text-primary" /> Daily Feed Rate
            <Badge variant="outline" className="text-[10px]">{settings.bagSize}kg = 1 bag</Badge>
            {currentRate && <Badge className="text-[10px]">Current: {Number(currentRate.kg_consumed)}kg/day · {money(currentRate.price_per_bag)}/bag since {currentRate.date}</Badge>}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Set it once — it applies to every day automatically until you set a new rate. A new rate only affects days from its start date onward.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1"><Label className="text-xs">Starts from</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Feed per day (kg)</Label>
              <Input type="number" step="0.01" min="0" value={form.kg} onChange={(e) => setForm({ ...form, kg: e.target.value })} placeholder="e.g. 11.5" /></div>
            <div className="space-y-1"><Label className="text-xs">Price per bag (₦)</Label>
              <Input type="number" min="0" value={form.pricePerBag} onChange={(e) => setForm({ ...form, pricePerBag: e.target.value })} placeholder="e.g. 22000" /></div>
            <div className="space-y-1"><Label className="text-xs">Notes (optional)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Feed brand, reason for change..." /></div>
          </div>
          {Number(form.kg) > 0 && Number(form.pricePerBag) > 0 && (
            <p className="text-xs text-muted-foreground">
              Cost per day: {(Number(form.kg) / settings.bagSize).toFixed(2)} bag(s) × {money(Number(form.pricePerBag))} = <b className="text-foreground">{money((Number(form.kg) / settings.bagSize) * Number(form.pricePerBag))}</b>
              {birds > 0 && <> · {Math.round((Number(form.kg) * 1000) / birds)} g/bird/day</>}
            </p>
          )}
          <Button size="sm" onClick={saveEntry} disabled={saving}>{currentRate ? "Save new rate" : "Set feed rate"}</Button>
        </CardContent>
      </Card>

      {/* Start-date gap prompt */}
      {needsBackfill && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs"><b>Cover earlier production days?</b> Egg records start on {firstProdDate}, but the feed rate starts {firstRateDate ? `on ${firstRateDate}` : "nowhere yet"}. Set the rate you used from {firstProdDate} once, so all-time profit is complete.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setForm((f) => ({ ...f, date: firstProdDate!, kg: f.kg || (currentRate ? String(currentRate.kg_consumed) : "") })); window.scrollTo({ top: 0, behavior: "smooth" }); }}><History className="h-4 w-4 mr-1" /> Set rate from {firstProdDate}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setBackfillDismissed(true); localStorage.setItem(`fi_backfill_dismissed_${batchId}`, "1"); }}>Later</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily economics chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Profit — eggs vs feed vs expenses (last 30 days)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {chartData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center pt-16">Record egg production and feed intake to build the daily profit chart.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Egg revenue" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Feed cost" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Other expenses" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="Net profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Intelligence */}
      <Card className={intelligence.status === "underfed" ? "border-destructive/50" : "border-primary/30"}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Feeding Intelligence</CardTitle>
          <Badge variant={statusBadge.cls} className="text-xs">{statusBadge.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {birds > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted/50 p-2"><p className="text-sm font-bold">{Math.round(intelligence.actual) || "—"}g</p><p className="text-[10px] text-muted-foreground">Actual g/bird/day (7d)</p></div>
              <div className="rounded-md bg-muted/50 p-2"><p className="text-sm font-bold">{Math.round(intelligence.expected)}g</p><p className="text-[10px] text-muted-foreground">Expected @ {batch?.age_weeks}wk</p></div>
              <div className="rounded-md bg-muted/50 p-2"><p className="text-sm font-bold">{totals.fcr != null ? totals.fcr.toFixed(2) : "—"}</p><p className="text-[10px] text-muted-foreground">FCR (kg feed / kg eggs)</p></div>
            </div>
          )}
          <div className="space-y-1">
            {intelligence.advice.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/40">
                {a.level === "good" ? <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  : a.level === "bad" ? <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                    : <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />}
                <span>{a.text}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Benchmarks: laying hens eat ~110–120 g/bird/day at peak; FCR target ≈ {TARGET_EGG_MASS_FCR} kg feed per kg of eggs.
          </p>
        </CardContent>
      </Card>

      {/* FCR helper */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Auto FCR (from daily feed & eggs)</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Avg egg weight (g)</Label>
            <Input
              type="number" min="40" max="80" className="w-20 h-7 text-xs"
              value={settings.avgEggWeightG}
              onChange={(e) => {
                const v = Number(e.target.value) || 62;
                setSettings((s) => ({ ...s, avgEggWeightG: v }));
                localStorage.setItem(`fi_eggW_${batchId}`, String(v));
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Weekly feed ÷ egg mass (eggs × {settings.avgEggWeightG}g) gives FCR per week below — no extra weighing needed.
            {totals.fcr != null && <> Overall so far: <b className="text-foreground">{totals.fcr.toFixed(2)} kg/kg</b>.</>}
          </p>
        </CardContent>
      </Card>

      {/* Weekly */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Profit per Week</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(weekly, `feed-profit-weekly-${batchId}`)}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekly.map((w: any) => ({ week: shortDate(w.week), "Net profit": Math.round(w.net), "Feed cost": Math.round(w.feedCost) }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="week" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => money(v)} />
                <Bar dataKey="Net profit" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Feed cost" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {weekly.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Week of</TableHead>
                    <TableHead className="text-xs">Eggs</TableHead>
                    <TableHead className="text-xs">Egg revenue</TableHead>
                    <TableHead className="text-xs">Feed (kg)</TableHead>
                    <TableHead className="text-xs">Feed cost</TableHead>
                    <TableHead className="text-xs">Other exp.</TableHead>
                    <TableHead className="text-xs">FCR</TableHead>
                    <TableHead className="text-xs">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...weekly].reverse().map((w: any) => (
                    <TableRow key={w.week}>
                      <TableCell className="text-xs">{w.week}</TableCell>
                      <TableCell className="text-xs">{w.eggs.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{money(w.eggRevenue)}</TableCell>
                      <TableCell className="text-xs">{w.feedKg.toFixed(1)}</TableCell>
                      <TableCell className="text-xs">{money(w.feedCost)}</TableCell>
                      <TableCell className="text-xs">{money(w.otherExp)}</TableCell>
                      <TableCell className="text-xs">{w.fcr ? w.fcr.toFixed(2) : "—"}</TableCell>
                      <TableCell className={`text-xs font-medium ${w.net >= 0 ? "text-primary" : "text-destructive"}`}>{money(w.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-xs text-muted-foreground text-center py-4">No weekly data yet</p>}
        </CardContent>
      </Card>

      {/* Monthly */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Profit per Month</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(monthly, `feed-profit-monthly-${batchId}`)}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly.map((m: any) => ({ month: m.month, "Net profit": Math.round(m.net), "Egg revenue": Math.round(m.eggRevenue), "Feed cost": Math.round(m.feedCost) }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Egg revenue" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Feed cost" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Net profit" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {monthly.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Month</TableHead>
                    <TableHead className="text-xs">Eggs</TableHead>
                    <TableHead className="text-xs">Egg revenue</TableHead>
                    <TableHead className="text-xs">Feed cost</TableHead>
                    <TableHead className="text-xs">Other exp.</TableHead>
                    <TableHead className="text-xs">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...monthly].reverse().map((m: any) => (
                    <TableRow key={m.month}>
                      <TableCell className="text-xs">{m.month}</TableCell>
                      <TableCell className="text-xs">{m.eggs.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{money(m.eggRevenue)}</TableCell>
                      <TableCell className="text-xs">{money(m.feedCost)}</TableCell>
                      <TableCell className="text-xs">{money(m.otherExp)}</TableCell>
                      <TableCell className={`text-xs font-medium ${m.net >= 0 ? "text-primary" : "text-destructive"}`}>{money(m.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-xs text-muted-foreground text-center py-4">No monthly data yet</p>}
        </CardContent>
      </Card>

      {/* Non-feed expenses this month */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Other (non-feed) expenses — {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[10px] text-muted-foreground mb-2">Feed costs are already counted above from daily intake, so feed-type expenses are excluded here to avoid double counting.</p>
          {nonFeedExpenses.filter((r) => r.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No non-feed expenses recorded this month</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">By</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonFeedExpenses.filter((r) => r.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.date}</TableCell>
                      <TableCell className="text-xs capitalize">{r.expense_type}</TableCell>
                      <TableCell className="text-xs">{r.description || "Nil"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.profiles?.name || "—"}</TableCell>
                      <TableCell className="text-xs">{money(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate history */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Feed Rate History</CardTitle></CardHeader>
        <CardContent>
          <p className="text-[10px] text-muted-foreground mb-2">Each rate applies every day from its start date until the next rate begins. Changing the rate never rewrites earlier days.</p>
          {feedRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No feed rate set yet</p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Effective from</TableHead>
                    <TableHead className="text-xs">Until</TableHead>
                    <TableHead className="text-xs">Kg / day</TableHead>
                    <TableHead className="text-xs">₦/bag</TableHead>
                    <TableHead className="text-xs">Cost / day</TableHead>
                    <TableHead className="text-xs">Notes</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedRows.map((r: any, i: number) => {
                    const next = i > 0 ? feedRows[i - 1] : null; // feedRows is newest first
                    const until = next ? addDays(next.date, -1) : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-medium">{r.date}</TableCell>
                        <TableCell className="text-xs">{until ? until : <Badge variant="default" className="text-[10px]">Current</Badge>}</TableCell>
                        <TableCell className="text-xs">{Number(r.kg_consumed).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{money(r.price_per_bag)}</TableCell>
                        <TableCell className="text-xs font-medium">{money(r.feed_cost)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-40 truncate">{r.notes || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Change rate from today" onClick={() => {
                              setForm({ date: today(), kg: String(r.kg_consumed), pricePerBag: String(r.price_per_bag), notes: "" });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                              toast.info("Adjust the values — the new rate starts from the date you pick; earlier days stay unchanged.");
                            }}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => { if (confirm("Remove this rate? Days it covered will use the previous rate.")) deleteEntry(r.id); }}><Trash2 className="h-3 w-3" /></Button>
                          </div>
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
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card><CardContent className="p-3 text-center">
      <p className={`text-base font-bold ${accent || ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}
