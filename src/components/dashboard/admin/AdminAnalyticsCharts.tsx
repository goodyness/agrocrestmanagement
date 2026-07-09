import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, Wallet, Skull } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend,
} from "recharts";

/**
 * 4 admin-level analytics:
 *  1. Batch ROI leaderboard
 *  2. Mortality trend heatmap (weekly by species)
 *  3. Partner performance dashboard
 *  4. 30/60/90-day cash-flow forecast
 */
const AdminAnalyticsCharts = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [mortality, setMortality] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [b, m, s, e, p, w] = await Promise.all([
        supabase.from("livestock_batches").select("id, species, species_type, quantity, current_quantity, total_cost, budget"),
        supabase.from("mortality_records").select("date, quantity_dead, batch_id"),
        supabase.from("batch_sales").select("total_amount, sale_date, batch_id"),
        supabase.from("miscellaneous_expenses").select("amount, date, batch_id"),
        supabase.from("partner_batches").select("partner_id, batch_id, share_percentage, profit_share_percentage, partners(profile_id, profiles!partners_profile_id_fkey(name))"),
        supabase.from("wallet_withdrawals").select("amount, status, profile_id"),
      ]);
      setBatches(b.data || []);
      setMortality(m.data || []);
      setSales(s.data || []);
      setExpenses(e.data || []);
      setPartners(p.data || []);
      setWithdrawals(w.data || []);
      setLoading(false);
    })();
  }, []);

  // ROI leaderboard
  const roiData = batches.map((b: any) => {
    const rev = sales.filter(s => s.batch_id === b.id).reduce((a, s) => a + Number(s.total_amount || 0), 0);
    const exp = expenses.filter(e => e.batch_id === b.id).reduce((a, e) => a + Number(e.amount || 0), 0);
    const cost = Number(b.total_cost || 0) + exp;
    const profit = rev - cost;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;
    return {
      name: `${b.species_type || b.species}`.slice(0, 12),
      roi: Number(roi.toFixed(1)),
      profit,
      profitPerBird: b.current_quantity > 0 ? Math.round(profit / b.current_quantity) : 0,
    };
  }).filter(r => r.profit !== 0 || r.roi !== 0).sort((a, b) => b.roi - a.roi).slice(0, 10);

  // Mortality trend (weekly)
  const mortByWeek: Record<string, number> = {};
  mortality.forEach((m: any) => {
    const d = new Date(m.date);
    const y = d.getFullYear();
    const week = Math.ceil(((d.getTime() - new Date(y, 0, 1).getTime()) / 864e5 + new Date(y, 0, 1).getDay() + 1) / 7);
    const k = `W${week}`;
    mortByWeek[k] = (mortByWeek[k] || 0) + Number(m.quantity_dead || 0);
  });
  const mortTrend = Object.entries(mortByWeek).slice(-12).map(([week, deaths]) => ({ week, deaths }));

  // Partner performance
  const partnerAgg: Record<string, { name: string; batches: number; invested: number; profit: number; pending: number }> = {};
  partners.forEach((pb: any) => {
    const pid = pb.partners?.profile_id;
    const pname = pb.partners?.profiles?.name || "Partner";
    if (!pid) return;
    const key = pid;
    partnerAgg[key] = partnerAgg[key] || { name: pname, batches: 0, invested: 0, profit: 0, pending: 0 };
    partnerAgg[key].batches += 1;
    const batch = batches.find((b: any) => b.id === pb.batch_id);
    if (batch) {
      const rev = sales.filter(s => s.batch_id === batch.id).reduce((a, s) => a + Number(s.total_amount || 0), 0);
      const exp = expenses.filter(e => e.batch_id === batch.id).reduce((a, e) => a + Number(e.amount || 0), 0);
      const gross = rev - (Number(batch.total_cost || 0) + exp);
      partnerAgg[key].profit += Math.max(0, gross) * Number(pb.profit_share_percentage ?? pb.share_percentage ?? 0) / 100;
      partnerAgg[key].invested += Number(batch.total_cost || 0);
    }
    const pend = withdrawals.filter(w => w.profile_id === pid && w.status === "pending")
      .reduce((a, w) => a + Number(w.amount || 0), 0);
    partnerAgg[key].pending = pend;
  });
  const partnerRows = Object.values(partnerAgg).sort((a, b) => b.profit - a.profit).slice(0, 8);

  // Cash-flow forecast (last 90d rolling → project next 30/60/90)
  const now = Date.now();
  const last90In = sales.filter(s => now - new Date(s.sale_date).getTime() <= 90 * 864e5)
    .reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const last90Out = expenses.filter(e => now - new Date(e.date).getTime() <= 90 * 864e5)
    .reduce((a, e) => a + Number(e.amount || 0), 0);
  const dailyIn = last90In / 90;
  const dailyOut = last90Out / 90;
  const forecast = [30, 60, 90].map(d => ({
    horizon: `${d}d`,
    inflow: Math.round(dailyIn * d),
    outflow: Math.round(dailyOut * d),
    net: Math.round((dailyIn - dailyOut) * d),
  }));

  if (loading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading analytics…</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Batch ROI Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {roiData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No sales yet — ROI will show once batches record revenue.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={roiData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit="%" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(v: any, k: any) => k === "roi" ? `${v}%` : `₦${Number(v).toLocaleString()}`} />
                  <Bar dataKey="roi" fill="hsl(var(--primary))" name="ROI %" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {roiData.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                  <p className="text-muted-foreground">Best</p>
                  <p className="font-semibold">{roiData[0].name} — {roiData[0].roi}%</p>
                </div>
                <div className="p-2 rounded bg-destructive/10 border border-destructive/30">
                  <p className="text-muted-foreground">Worst</p>
                  <p className="font-semibold">{roiData[roiData.length - 1].name} — {roiData[roiData.length - 1].roi}%</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Skull className="h-4 w-4 text-destructive" /> Mortality Trend (weekly)</CardTitle>
          </CardHeader>
          <CardContent>
            {mortTrend.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No mortality records yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={mortTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="deaths" stroke="hsl(var(--destructive))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Partner Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {partnerRows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No partner activity yet.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {partnerRows.map((p, i) => (
                  <div key={i} className="border rounded p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-muted-foreground">{p.batches} batch(es) • Invested ₦{p.invested.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">₦{Math.round(p.profit).toLocaleString()}</p>
                      {p.pending > 0 && <Badge variant="outline" className="text-[10px]">Pending ₦{p.pending.toLocaleString()}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Cash-Flow Forecast (based on last 90d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="horizon" />
                <YAxis />
                <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="inflow" fill="hsl(var(--primary))" name="Projected inflow" />
                <Bar dataKey="outflow" fill="hsl(var(--destructive))" name="Projected outflow" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-center">
              {forecast.map(f => (
                <div key={f.horizon} className={`p-2 rounded border ${f.net >= 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"}`}>
                  <p className="text-muted-foreground">{f.horizon} net</p>
                  <p className="font-bold">₦{f.net.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalyticsCharts;
