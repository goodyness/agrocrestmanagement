import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Sparkles } from "lucide-react";

const TARGET = 2.1; // kg feed per kg egg mass
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const mondayOf = (d: string) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };

/** Automatic weekly FCR for layers, built from the Feed & Profit daily feed rate and egg production. */
export default function AutoLayerFcr({ batch, onHasData }: { batch: any; onHasData?: (v: boolean) => void }) {
  const [rates, setRates] = useState<any[]>([]);
  const [prod, setProd] = useState<any[]>([]);
  const eggW = Number(localStorage.getItem(`fi_eggW_${batch?.id}`)) || 62;

  useEffect(() => {
    if (!batch?.id) return;
    Promise.all([
      supabase.from("batch_feed_intake").select("date, kg_consumed").eq("batch_id", batch.id).order("date", { ascending: true }),
      supabase.from("batch_egg_production").select("date, crates, pieces").eq("batch_id", batch.id),
    ]).then(([r, p]) => {
      setRates(r.data || []); setProd(p.data || []);
      onHasData?.((r.data || []).length > 0);
    });
  }, [batch?.id]);

  const weekly = useMemo(() => {
    if (!rates.length) return [];
    const eggsBy: Record<string, number> = {};
    prod.forEach((p: any) => { eggsBy[p.date] = (eggsBy[p.date] || 0) + Number(p.crates || 0) * 30 + Number(p.pieces || 0); });
    const m: Record<string, { week: string; feedKg: number; eggs: number }> = {};
    let ri = 0;
    for (let d = rates[0].date; d <= today(); d = addDays(d, 1)) {
      while (ri + 1 < rates.length && rates[ri + 1].date <= d) ri++;
      const w = mondayOf(d);
      m[w] = m[w] || { week: w, feedKg: 0, eggs: 0 };
      m[w].feedKg += Number(rates[ri].kg_consumed || 0);
      m[w].eggs += eggsBy[d] || 0;
    }
    return Object.values(m).sort((a, b) => a.week.localeCompare(b.week)).map((w) => {
      const mass = (w.eggs * eggW) / 1000;
      return { ...w, eggMassKg: mass, fcr: mass > 0 ? w.feedKg / mass : null };
    });
  }, [rates, prod, eggW]);

  if (!rates.length) return null;
  const valid = weekly.filter((w) => w.fcr);
  const latest = valid[valid.length - 1]?.fcr ?? null;
  const totFeed = weekly.reduce((s, w) => s + w.feedKg, 0);
  const totMass = weekly.reduce((s, w) => s + w.eggMassKg, 0);
  const overall = totMass > 0 ? totFeed / totMass : null;
  const verdict = (v: number | null) => v == null ? null : v <= TARGET * 0.85 ? { t: "Excellent", c: "default" as const } : v <= TARGET * 1.2 ? { t: "Normal", c: "secondary" as const } : { t: "Poor", c: "destructive" as const };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" /> Automatic FCR (layers)
          <Badge variant="outline" className="text-[10px]">Updates itself from your Feed &amp; Profit rate + egg records</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <Box label="Latest week FCR" value={latest ? latest.toFixed(2) : "—"} badge={verdict(latest)} />
          <Box label="Overall FCR" value={overall ? overall.toFixed(2) : "—"} badge={verdict(overall)} />
          <Box label="Total feed (kg)" value={totFeed.toFixed(0)} />
          <Box label="Egg mass (kg)" value={totMass.toFixed(1)} />
        </div>
        {valid.length > 0 && (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly.map((w) => ({ week: w.week.slice(5), FCR: w.fcr ? Number(w.fcr.toFixed(2)) : null, Target: TARGET }))}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="week" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="FCR" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="Target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Week of</TableHead><TableHead className="text-xs">Feed (kg)</TableHead>
              <TableHead className="text-xs">Eggs</TableHead><TableHead className="text-xs">Egg mass (kg)</TableHead><TableHead className="text-xs">FCR</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {[...weekly].reverse().map((w) => (
                <TableRow key={w.week}>
                  <TableCell className="text-xs">{w.week}</TableCell><TableCell className="text-xs">{w.feedKg.toFixed(1)}</TableCell>
                  <TableCell className="text-xs">{w.eggs.toLocaleString()}</TableCell><TableCell className="text-xs">{w.eggMassKg.toFixed(1)}</TableCell>
                  <TableCell className="text-xs font-medium">{w.fcr ? w.fcr.toFixed(2) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] text-muted-foreground">FCR = feed eaten ÷ egg mass (eggs × {eggW}g). Target ≈ {TARGET}. No manual entry needed — change the feed rate or egg weight in Feed &amp; Profit and this updates automatically.</p>
      </CardContent>
    </Card>
  );
}

function Box({ label, value, badge }: { label: string; value: string; badge?: { t: string; c: any } | null }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      {badge && <Badge variant={badge.c} className="text-[9px] mt-1">{badge.t}</Badge>}
    </div>
  );
}
