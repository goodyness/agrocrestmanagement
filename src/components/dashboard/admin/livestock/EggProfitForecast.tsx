import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { Target, TrendingUp, TrendingDown, Gauge, Wallet, CalendarClock, Lightbulb, Activity } from "lucide-react";

const PIECES_PER_CRATE = 30;
const DAY = 86400000;

interface Props {
  batchId: string;
  rows: any[];           // batch_egg_production rows
  purchaseCost: number;
  currentPrice: number;  // per crate
  birds: number;
  ageWeeks: number;
}

const money = (n: number) => `₦${Math.round(n || 0).toLocaleString()}`;
const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const short = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** least-squares slope of y over index */
function slope(ys: number[]) {
  const n = ys.length;
  if (n < 3) return 0;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  return den ? num / den : 0;
}

export default function EggProfitForecast({ batchId, rows, purchaseCost, currentPrice, birds, ageWeeks }: Props) {
  const [expenses, setExpenses] = useState<{ date: string; amount: number }[]>([]);

  useEffect(() => {
    supabase.from("miscellaneous_expenses").select("amount, date, created_at").eq("batch_id", batchId)
      .then(({ data }) => setExpenses((data || []).map((e: any) => ({
        date: (e.date || e.created_at || "").slice(0, 10), amount: Number(e.amount || 0),
      }))));
  }, [batchId, rows.length]);

  const model = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const todayD = new Date(new Date().toISOString().slice(0, 10));
    const goodOf = (r: any) => Math.max(Number(r.crates || 0) * PIECES_PER_CRATE + Number(r.pieces || 0) - Number(r.cracked_pieces || 0), 0);
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    const totalCost = purchaseCost + totalExp;
    const totalValue = rows.reduce((s, r) => s + Number(r.egg_value || 0), 0);
    const balance = totalValue - totalCost;

    // --- production signal: last 30 days, daily good eggs
    const recent = sorted.slice(-30);
    const daily = recent.map(goodOf);
    const last14 = daily.slice(-14);
    const baseEggs = last14.length ? last14.reduce((a, b) => a + b, 0) / last14.length : 0;
    const rawSlope = slope(daily); // eggs/day change per day
    // clamp trend to ±1% of base per day, then dampen over time
    const trend = Math.max(Math.min(rawSlope, baseEggs * 0.01), -baseEggs * 0.01);
    const mean = daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : 0;
    const sd = daily.length > 1 ? Math.sqrt(daily.reduce((s, y) => s + (y - mean) ** 2, 0) / (daily.length - 1)) : 0;
    const cv = mean > 0 ? sd / mean : 1;
    const crackRate = (() => {
      const tot = recent.reduce((s, r) => s + Number(r.crates || 0) * PIECES_PER_CRATE + Number(r.pieces || 0), 0);
      const cr = recent.reduce((s, r) => s + Number(r.cracked_pieces || 0), 0);
      return tot > 0 ? (cr / tot) * 100 : 0;
    })();

    // --- expense burn: last 30 days of dated expenses (fallback: lifetime average)
    const cutoff = new Date(todayD.getTime() - 30 * DAY).toISOString().slice(0, 10);
    const exp30 = expenses.filter((e) => e.date >= cutoff).reduce((s, e) => s + e.amount, 0);
    const firstDate = sorted[0]?.date || expenses.map((e) => e.date).sort()[0];
    const lifeDays = firstDate ? Math.max((todayD.getTime() - new Date(firstDate).getTime()) / DAY, 1) : 30;
    const burnLife = totalExp / lifeDays;
    const burn = exp30 > 0 ? exp30 / 30 : burnLife;
    const burnTrend = burnLife > 0 ? ((exp30 / 30 - burnLife) / burnLife) * 100 : 0;

    const pricePerEgg = currentPrice / PIECES_PER_CRATE;
    const dailyRevenue = baseEggs * pricePerEgg;
    const netDaily = dailyRevenue - burn;
    const layRate = birds > 0 ? (baseEggs / birds) * 100 : 0;

    // layer curve: after ~72 weeks expect ~0.6%/week natural decline
    const ageDecline = (d: number) => {
      const w = ageWeeks + d / 7;
      return w > 72 ? Math.max(1 - (w - 72) * 0.006, 0.5) : 1;
    };

    const simulate = (eggMul: number, costMul: number, horizon = 730) => {
      let cum = balance;
      const pts: number[] = [];
      let hit: number | null = cum >= 0 ? 0 : null;
      for (let d = 1; d <= horizon; d++) {
        const damp = Math.exp(-d / 60); // trend fades over ~2 months
        const eggs = Math.max((baseEggs + trend * 60 * (1 - damp)) * ageDecline(d) * eggMul, 0);
        cum += eggs * pricePerEgg - burn * costMul;
        pts.push(cum);
        if (hit === null && cum >= 0) hit = d;
      }
      return { pts, hit };
    };

    const base = simulate(1, 1);
    const pess = simulate(0.85, 1.15);
    const opt = simulate(1.1, 0.9);

    // chart: history (cumulative) + 180-day projection
    const events = new Map<string, number>();
    sorted.forEach((r) => events.set(r.date, (events.get(r.date) || 0) + Number(r.egg_value || 0)));
    expenses.forEach((e) => events.set(e.date, (events.get(e.date) || 0) - e.amount));
    let run = -purchaseCost;
    const hist = [...events.keys()].sort().map((d) => { run += events.get(d)!; return { label: short(new Date(d)), actual: Math.round(run) }; });
    const horizonShown = Math.min(Math.max((base.hit ?? 180) + 30, 60), 365);
    const proj: any[] = [];
    for (let d = 0; d <= horizonShown; d += Math.max(1, Math.round(horizonShown / 40))) {
      const idx = Math.max(d - 1, 0);
      proj.push({
        label: short(new Date(todayD.getTime() + d * DAY)),
        base: Math.round(d === 0 ? balance : base.pts[idx]),
        range: [Math.round(d === 0 ? balance : pess.pts[idx]), Math.round(d === 0 ? balance : opt.pts[idx])],
      });
    }
    const chart = [...hist.slice(-40), ...proj.map((p, i) => (i === 0 ? { ...p, actual: Math.round(balance) } : p))];

    // confidence
    let conf = 100;
    if (daily.length < 7) conf -= 45; else if (daily.length < 14) conf -= 25; else if (daily.length < 30) conf -= 10;
    conf -= Math.min(cv * 60, 30);
    if (!currentPrice) conf -= 30;
    if (expenses.length < 3) conf -= 10;
    conf = Math.max(Math.round(conf), 5);

    const at = (days: number | null) => (days == null ? null : new Date(todayD.getTime() + days * DAY));

    // insights
    const tips: { tone: "good" | "warn" | "info"; text: string }[] = [];
    if (rawSlope > baseEggs * 0.003) tips.push({ tone: "good", text: `Production is climbing (~${(rawSlope * 7).toFixed(0)} more eggs/day each week) — breakeven is likely to come sooner.` });
    else if (rawSlope < -baseEggs * 0.003) tips.push({ tone: "warn", text: `Production is slipping (~${Math.abs(rawSlope * 7).toFixed(0)} fewer eggs/day each week). Check feed, water, lighting and health.` });
    if (burnTrend > 20) tips.push({ tone: "warn", text: `Spending in the last 30 days is ${burnTrend.toFixed(0)}% above this batch's usual rate.` });
    else if (burnTrend < -20) tips.push({ tone: "good", text: `Spending has eased — ${Math.abs(burnTrend).toFixed(0)}% below the usual rate.` });
    if (crackRate > 5) tips.push({ tone: "warn", text: `${crackRate.toFixed(1)}% of eggs are cracked. Cutting this to 2% would add about ${money(baseEggs * (crackRate - 2) / 100 * pricePerEgg * 30)} a month.` });
    if (layRate > 0 && layRate < 70 && ageWeeks >= 25 && ageWeeks <= 70) tips.push({ tone: "warn", text: `Lay rate is ${layRate.toFixed(0)}%, below the 80%+ expected at ${ageWeeks} weeks.` });
    if (ageWeeks > 72) tips.push({ tone: "info", text: `Flock is ${ageWeeks} weeks old — natural decline is built into the forecast. Plan for culling/replacement.` });
    if (netDaily > 0 && balance < 0) {
      const need = Math.abs(balance);
      tips.push({ tone: "info", text: `Each extra ₦100 per crate shortens the wait by about ${Math.max(Math.round(need / netDaily - need / (netDaily + baseEggs / PIECES_PER_CRATE * 100)), 0)} days.` });
    }
    if (netDaily <= 0) tips.push({ tone: "warn", text: `Daily spending (${money(burn)}) is higher than daily egg value (${money(dailyRevenue)}). At this pace the batch will not break even — raise output, price, or cut costs.` });

    return {
      totalCost, totalValue, balance, baseEggs, layRate, burn, dailyRevenue, netDaily, crackRate,
      breakeven: at(base.hit), early: at(opt.hit), late: at(pess.hit), daysToBreak: base.hit,
      profit30: base.pts[29] - balance, profit90: base.pts[89] - balance,
      endOf90: base.pts[89], endOf180: base.pts[179],
      chart, conf, tips, dataDays: daily.length, rawSlope,
    };
  }, [rows, expenses, purchaseCost, currentPrice, birds, ageWeeks]);

  if (rows.length < 3) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Profit forecast</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Record at least 3 days of production to unlock the profit forecast.</p></CardContent>
      </Card>
    );
  }

  const m = model;
  const inProfit = m.balance >= 0;
  const confTone = m.conf >= 70 ? "text-success" : m.conf >= 40 ? "text-amber-600" : "text-destructive";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Profit forecast</CardTitle>
            <CardDescription>Based on your production trend, spending pattern, crate price, cracked eggs and flock age.</CardDescription>
          </div>
          <Badge variant="outline" className={confTone}><Gauge className="h-3 w-3 mr-1" /> {m.conf}% confidence</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* headline */}
        <div className={`rounded-xl border p-4 ${inProfit ? "border-success/40 bg-success/5" : m.breakeven ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
          {inProfit ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="text-xl font-bold text-success">Already in profit — {money(m.balance)}</p>
              <p className="text-sm text-muted-foreground mt-1">Expected extra profit: {money(m.profit30)} in 30 days, {money(m.profit90)} in 90 days.</p>
            </>
          ) : m.breakeven ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Profit expected to start</p>
              <p className="text-2xl font-bold text-primary flex items-center gap-2"><CalendarClock className="h-5 w-5" /> {fmtDate(m.breakeven)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                In about <b>{m.daysToBreak} days</b> (~{(m.daysToBreak! / 30).toFixed(1)} months).
                Range: {m.early ? fmtDate(m.early) : "—"} (good case) to {m.late ? fmtDate(m.late) : "beyond 2 years"} (tough case).
              </p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Profit outlook</p>
              <p className="text-xl font-bold text-destructive">No breakeven in the next 2 years at the current pace</p>
              <p className="text-sm text-muted-foreground mt-1">See the suggestions below to change course.</p>
            </>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Activity, label: "Good eggs / day", value: `${Math.round(m.baseEggs)}`, sub: `${m.layRate.toFixed(0)}% lay rate`, trend: m.rawSlope },
            { icon: Wallet, label: "Egg value / day", value: money(m.dailyRevenue), sub: "at current price" },
            { icon: TrendingDown, label: "Spending / day", value: money(m.burn), sub: "last 30 days" },
            { icon: TrendingUp, label: "Net / day", value: money(m.netDaily), sub: m.netDaily >= 0 ? "recovering" : "losing", tone: m.netDaily >= 0 ? "text-success" : "text-destructive" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><k.icon className="h-3 w-3" /> {k.label}</span>
                {k.trend !== undefined && (k.trend > 0 ? <TrendingUp className="h-3 w-3 text-success" /> : k.trend < 0 ? <TrendingDown className="h-3 w-3 text-destructive" /> : null)}
              </div>
              <p className={`text-lg font-bold mt-1 ${k.tone || ""}`}>{k.value}</p>
              <p className="text-[11px] text-muted-foreground">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* chart */}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={m.chart}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} width={56} />
              <Tooltip formatter={(v: any) => (Array.isArray(v) ? `${money(v[0])} – ${money(v[1])}` : money(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="hsl(var(--success))" strokeDasharray="4 4" label={{ value: "Breakeven", fontSize: 10, fill: "hsl(var(--success))" }} />
              <Area dataKey="range" name="Likely range" fill="hsl(var(--primary) / 0.15)" stroke="none" />
              <Line dataKey="actual" name="Actual balance" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
              <Line dataKey="base" name="Forecast" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* milestones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Balance today</p><p className={`font-bold ${inProfit ? "text-success" : "text-destructive"}`}>{money(m.balance)}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Expected in 90 days</p><p className={`font-bold ${m.endOf90 >= 0 ? "text-success" : "text-destructive"}`}>{money(m.endOf90)}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Expected in 6 months</p><p className={`font-bold ${m.endOf180 >= 0 ? "text-success" : "text-destructive"}`}>{money(m.endOf180)}</p></div>
        </div>

        {/* insights */}
        {m.tips.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1"><Lightbulb className="h-4 w-4 text-amber-500" /> What's driving this</p>
            {m.tips.map((t, i) => (
              <div key={i} className={`text-sm rounded-md border-l-4 px-3 py-2 bg-muted/30 ${t.tone === "good" ? "border-l-success" : t.tone === "warn" ? "border-l-amber-500" : "border-l-primary"}`}>{t.text}</div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Uses the last {m.dataDays} production days, recent spending, current crate price, cracked-egg rate and natural decline after 72 weeks. Good/tough cases assume ±10–15% on eggs and costs. Updates every time you record.
        </p>
      </CardContent>
    </Card>
  );
}
