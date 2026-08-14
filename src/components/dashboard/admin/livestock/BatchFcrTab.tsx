import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { Plus, Scale } from "lucide-react";

interface Props { batch: any; open?: boolean; onOpenChange?: (v: boolean) => void; onSaved?: () => void }

const ANIMAL_TYPES = ["broiler", "layer", "cockerel", "noiler", "turkey", "pig", "goat", "cattle", "other"];

// Rough industry FCR targets used only as a visual reference line
const TARGET_FCR: Record<string, number> = { broiler: 1.7, noiler: 2.2, cockerel: 2.6, layer: 2.4, turkey: 2.6, pig: 3.0, goat: 5.0, cattle: 6.5, other: 2.5 };

export default function BatchFcrTab({ batch, open, onOpenChange, onSaved }: Props) {
  const batchId = batch?.id;
  const [rows, setRows] = useState<any[]>([]);
  const [feedTypes, setFeedTypes] = useState<any[]>([]);
  const [internalOpen, setInternalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const setDialogOpen = onOpenChange ?? setInternalOpen;

  const [f, setF] = useState<any>({
    record_date: new Date().toISOString().slice(0, 10),
    animal_type: batch?.species_type || batch?.species || "broiler",
    sample_size: "",
    avg_weight_g: "",
    feed_consumed_kg: "",
    feed_type_id: "",
    observation: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("batch_fcr_records" as any)
      .select("*, profiles:recorded_by(name)")
      .eq("batch_id", batchId)
      .order("record_date", { ascending: true });
    setRows((data as any[]) || []);

    let q = supabase.from("feed_types").select("id, feed_name").order("feed_name");
    if (batch?.branch_id) q = q.eq("branch_id", batch.branch_id);
    const { data: ft } = await q;
    setFeedTypes(ft || []);
  };

  useEffect(() => { if (batchId) load(); }, [batchId]);

  // Prefill feed consumed from logged consumption since the last FCR entry
  useEffect(() => {
    if (!dialogOpen || !batchId) return;
    const since = rows.length ? rows[rows.length - 1].record_date : batch?.date_acquired;
    supabase
      .from("feed_consumption")
      .select("quantity_used, unit, date")
      .eq("batch_id", batchId)
      .gte("date", since || "1970-01-01")
      .then(({ data }) => {
        const kg = (data || []).reduce((s: number, r: any) => {
          const q = Number(r.quantity_used || 0);
          return s + (r.unit === "g" ? q / 1000 : r.unit === "bag" ? q * 25 : q);
        }, 0);
        if (kg > 0) setF((p: any) => ({ ...p, feed_consumed_kg: p.feed_consumed_kg || kg.toFixed(2) }));
      });
  }, [dialogOpen, batchId]);

  const last = rows.length ? rows[rows.length - 1] : null;
  const daysSinceLast = last ? Math.floor((Date.now() - new Date(last.record_date).getTime()) / 86400000) : null;
  const dueForEntry = daysSinceLast === null ? true : daysSinceLast >= 7;

  const computed = useMemo(() => {
    const sample = Number(f.sample_size) || 0;
    const avg = Number(f.avg_weight_g) || 0;
    const feed = Number(f.feed_consumed_kg) || 0;
    const live = Number(batch?.current_quantity || 0);
    const prevAvg = Number(last?.avg_weight_g || 0);
    const gainPerBirdKg = (avg - prevAvg) / 1000;
    const totalGain = gainPerBirdKg * live;
    const fcr = totalGain > 0 ? feed / totalGain : 0;
    return { sample, avg, feed, live, totalGain, fcr };
  }, [f, last, batch]);

  const chartData = rows.map((r) => ({
    date: new Date(r.record_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    fcr: Number(r.fcr || 0),
    weight: Number(r.avg_weight_g || 0) / 1000,
    target: TARGET_FCR[r.animal_type] || 2.5,
  }));

  const avgFcr = rows.length ? rows.reduce((s, r) => s + Number(r.fcr || 0), 0) / rows.filter((r) => Number(r.fcr) > 0).length || 0 : 0;

  const submit = async () => {
    if (!computed.sample || computed.sample <= 0) return toast.error("Enter how many animals were sampled");
    if (!computed.avg || computed.avg <= 0) return toast.error("Enter the average weight in grams");
    if (computed.feed <= 0) return toast.error("Enter the feed consumed since the last check (kg)");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_fcr_records" as any).insert([{
      batch_id: batchId,
      branch_id: batch?.branch_id || null,
      record_date: f.record_date,
      week_number: batch?.age_weeks ?? null,
      animal_type: f.animal_type,
      sample_size: computed.sample,
      avg_weight_g: computed.avg,
      feed_consumed_kg: computed.feed,
      feed_type_id: f.feed_type_id || null,
      live_count: computed.live,
      weight_gain_kg: Number(computed.totalGain.toFixed(3)),
      fcr: computed.fcr > 0 ? Number(computed.fcr.toFixed(3)) : null,
      observation: f.observation?.slice(0, 800) || null,
      recorded_by: user?.id || null,
    }] as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Weekly feeding record saved");
    setF({ ...f, sample_size: "", avg_weight_g: "", feed_consumed_kg: "", observation: "" });
    setDialogOpen(false);
    load();
    onSaved?.();
  };

  return (
    <div className="space-y-3">
      {dueForEntry && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs">
              <b>Weekly FCR check due.</b>{" "}
              {last ? `Last recorded ${daysSinceLast} days ago.` : "No feeding performance recorded for this batch yet."}
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Record FCR</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Entries" value={String(rows.length)} />
        <Stat label="Latest FCR" value={last?.fcr ? Number(last.fcr).toFixed(2) : "—"} />
        <Stat label="Average FCR" value={avgFcr ? avgFcr.toFixed(2) : "—"} />
        <Stat label="Latest avg weight" value={last?.avg_weight_g ? `${(Number(last.avg_weight_g) / 1000).toFixed(2)} kg` : "—"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Feed Conversion Trend</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Entry</Button>
        </CardHeader>
        <CardContent>
          {chartData.length < 1 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Record entries weekly to build the FCR curve.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="fcr" name="FCR" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="target" name="Target FCR" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="weight" name="Avg weight (kg)" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Records</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No feeding records yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sample</TableHead>
                    <TableHead>Avg wt (kg)</TableHead>
                    <TableHead>Feed (kg)</TableHead>
                    <TableHead>Gain (kg)</TableHead>
                    <TableHead>FCR</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows].reverse().map((r) => {
                    const target = TARGET_FCR[r.animal_type] || 2.5;
                    const good = r.fcr && Number(r.fcr) <= target;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.record_date}</TableCell>
                        <TableCell className="text-xs capitalize">{r.animal_type}</TableCell>
                        <TableCell>{r.sample_size}</TableCell>
                        <TableCell>{(Number(r.avg_weight_g) / 1000).toFixed(2)}</TableCell>
                        <TableCell>{Number(r.feed_consumed_kg).toFixed(1)}</TableCell>
                        <TableCell>{r.weight_gain_kg ? Number(r.weight_gain_kg).toFixed(1) : "—"}</TableCell>
                        <TableCell>
                          {r.fcr ? <Badge variant={good ? "default" : "destructive"} className="text-[10px]">{Number(r.fcr).toFixed(2)}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.profiles?.name || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Weekly Feeding / FCR Check</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.record_date} onChange={(e) => setF({ ...f, record_date: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Animal type</Label>
                <Select value={f.animal_type} onValueChange={(v) => setF({ ...f, animal_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ANIMAL_TYPES.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Animals sampled</Label><Input type="number" min={1} value={f.sample_size} onChange={(e) => setF({ ...f, sample_size: e.target.value })} /></div>
              <div className="space-y-1"><Label>Average weight (g)</Label><Input type="number" min={0} value={f.avg_weight_g} onChange={(e) => setF({ ...f, avg_weight_g: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Feed consumed since last check (kg)</Label>
                <Input type="number" min={0} value={f.feed_consumed_kg} onChange={(e) => setF({ ...f, feed_consumed_kg: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Feed type</Label>
                <Select value={f.feed_type_id || "none"} onValueChange={(v) => setF({ ...f, feed_type_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {feedTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.feed_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1"><Label>Observation</Label><Textarea rows={2} value={f.observation} onChange={(e) => setF({ ...f, observation: e.target.value })} maxLength={800} placeholder="Appetite, uniformity, water intake, health notes..." /></div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span>Live animals</span><b>{computed.live}</b></div>
              <div className="flex justify-between"><span>Previous avg weight</span><b>{last ? `${(Number(last.avg_weight_g) / 1000).toFixed(2)} kg` : "— (first entry)"}</b></div>
              <div className="flex justify-between"><span>Estimated total gain</span><b>{computed.totalGain > 0 ? `${computed.totalGain.toFixed(1)} kg` : "—"}</b></div>
              <div className="flex justify-between"><span>Calculated FCR</span><b>{computed.fcr > 0 ? computed.fcr.toFixed(2) : "—"}</b></div>
              <p className="text-[10px] text-muted-foreground">FCR = feed consumed ÷ total live-weight gain. Lower is better; target for {f.animal_type} ≈ {TARGET_FCR[f.animal_type] || 2.5}.</p>
            </div>

            <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Entry"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-3 text-center">
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </CardContent></Card>
  );
}
