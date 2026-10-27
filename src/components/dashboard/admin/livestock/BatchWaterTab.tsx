import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Droplets, Pencil, Download, Copy, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea } from 'recharts';
import { waterChange } from '@/lib/batchTools';
import { toast } from 'sonner';

type Water = { id: string; date: string; litres: number; birds_at_record: number; temperature_c: number | null; notes: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

/** Approximate healthy ml/bird/day range for chickens by age and type. */
function waterRange(batch: any, ageWeeks: number): [number, number] | null {
  const text = `${batch.livestock_categories?.name || ''} ${batch.chicken_type || ''} ${batch.breed || ''} ${batch.name || ''}`.toLowerCase();
  const isChicken = /chick|layer|broiler|noiler|bird|poultry|hen/.test(text);
  if (!isChicken) return null;
  const w = Math.max(1, ageWeeks || 1);
  if (/layer|hen/.test(text) && w >= 18) return [200, 300];
  if (/broiler/.test(text)) return [Math.min(30 + (w - 1) * 50, 300), Math.min(60 + (w - 1) * 60, 400)];
  return [Math.min(25 + (w - 1) * 25, 200), Math.min(50 + (w - 1) * 35, 300)];
}

export default function BatchWaterTab({ batch }: { batch: any }) {
  const [rows, setRows] = useState<Water[]>([]);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [useRange, setUseRange] = useState(false);
  const initial = { date: today(), endDate: today(), litres: '', birds: String(batch.current_quantity || ''), temperature: '', notes: '' };
  const [form, setForm] = useState(initial);

  const load = async () => {
    const { data, error } = await supabase.from('batch_water_records').select('*').eq('batch_id', batch.id).order('date');
    if (error) toast.error(error.message); else setRows(data || []);
  };
  useEffect(() => { load(); }, [batch.id]);

  const rangeDays = useMemo(() => {
    if (!useRange) return [form.date];
    const out: string[] = []; let d = form.date;
    while (d <= form.endDate && out.length < 92) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [useRange, form.date, form.endDate]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeDays.length) { toast.error('End date must be on or after the start date'); return; }
    if (useRange && form.endDate > today()) { toast.error('End date cannot be in the future'); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const payload = rangeDays.map(date => ({ batch_id: batch.id, date, litres: Number(form.litres), birds_at_record: Number(form.birds), temperature_c: form.temperature ? Number(form.temperature) : null, notes: form.notes || null, recorded_by: user.id }));
    const { error } = await supabase.from('batch_water_records').upsert(payload, { onConflict: 'batch_id,date' });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(payload.length > 1 ? `Saved ${payload.length} days of water records` : 'Water consumption saved'); setForm(initial); setUseRange(false); load(); }
  };

  const reuseLast = () => {
    const l = rows.at(-1); if (!l) return;
    const next = l.date >= today() ? today() : addDays(l.date, 1);
    setForm({ date: next, endDate: today(), litres: String(l.litres), birds: String(batch.current_quantity || l.birds_at_record), temperature: l.temperature_c === null ? '' : String(l.temperature_c), notes: '' });
    setUseRange(next < today());
    toast.info(next < today() ? 'Last record copied — fill every missed day up to today, or adjust the dates' : 'Last record copied for today');
  };

  const chart = rows.map(r => ({ ...r, mlPerBird: Math.round(Number(r.litres) * 1000 / r.birds_at_record) }));
  const last = chart.at(-1); const prev = chart.at(-2);
  const consecutive = last && prev && Math.round((Date.parse(last.date) - Date.parse(prev.date)) / 86400000) === 1;
  const delta = last && prev && consecutive ? waterChange(last.mlPerBird, prev.mlPerBird) : null;
  const range = waterRange(batch, Number(batch.age_weeks || 0));

  const insights = useMemo(() => {
    const list: { tone: 'good' | 'warn' | 'info'; text: string }[] = [];
    if (!chart.length) return list;
    const recent = chart.slice(-7).map(r => r.mlPerBird); const before = chart.slice(-14, -7).map(r => r.mlPerBird);
    const r7 = avg(recent);
    if (range) {
      if (r7 < range[0] * 0.85) list.push({ tone: 'warn', text: `7-day average is ${Math.round(r7)} ml per bird, below the expected ${range[0]}–${range[1]} ml for this age. Check drinkers for blockage, low pressure or birds that are off feed.` });
      else if (r7 > range[1] * 1.2) list.push({ tone: 'warn', text: `7-day average is ${Math.round(r7)} ml per bird, above the expected ${range[0]}–${range[1]} ml. Look for leaks, heat stress or salty feed.` });
      else list.push({ tone: 'good', text: `Doing well: 7-day average of ${Math.round(r7)} ml per bird is within the expected ${range[0]}–${range[1]} ml for this age.` });
    }
    if (before.length >= 3) {
      const ch = waterChange(r7, avg(before));
      if (ch !== null && Math.abs(ch) >= 10) list.push({ tone: Math.abs(ch) >= 20 ? 'warn' : 'info', text: `Water intake is ${ch > 0 ? 'up' : 'down'} ${Math.abs(ch).toFixed(0)}% compared with the previous week.` });
      else if (ch !== null) list.push({ tone: 'good', text: 'Intake is steady compared with the previous week.' });
    }
    const span = Math.round((Date.parse(today()) - Date.parse(chart[Math.max(0, chart.length - 14)].date)) / 86400000) + 1;
    const recorded = chart.filter(r => Date.parse(r.date) >= Date.parse(today()) - 13 * 86400000).length;
    if (span >= 3 && recorded < Math.min(14, span)) list.push({ tone: 'info', text: `${Math.min(14, span) - recorded} of the last ${Math.min(14, span)} days have no water record. Use "Reuse last record" to fill them quickly.` });
    const withTemp = chart.filter(r => r.temperature_c !== null);
    if (withTemp.length >= 4) {
      const hot = withTemp.filter(r => Number(r.temperature_c) >= 30).map(r => r.mlPerBird); const cool = withTemp.filter(r => Number(r.temperature_c) < 30).map(r => r.mlPerBird);
      if (hot.length && cool.length) list.push({ tone: 'info', text: `On hot days (30 °C+) birds drank about ${Math.round(avg(hot))} ml vs ${Math.round(avg(cool))} ml on cooler days.` });
    }
    return list;
  }, [rows, range?.[0], range?.[1]]);

  const exportCsv = () => {
    const csv = ['Date,Litres,Birds,ml per bird,Temperature C', ...chart.map(r => `${r.date},${r.litres},${r.birds_at_record},${r.mlPerBird},${r.temperature_c ?? ''}`)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'batch-water.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const fields: [keyof typeof form, string, string][] = [['date', useRange ? 'From date' : 'Date', 'date'], ...(useRange ? [['endDate', 'To date', 'date'] as [keyof typeof form, string, string]] : []), ['litres', 'Water per day (litres)', 'number'], ['birds', 'Animals', 'number'], ['temperature', 'Temperature °C (optional)', 'number']];

  return <section className="space-y-5">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold text-lg flex items-center gap-2"><Droplets className="h-5 w-5" />Water consumption</h3>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reuseLast} disabled={!rows.length}><Copy className="h-4 w-4 mr-1" />Reuse last record</Button>
        <Button variant="outline" size="icon" title="Export water records" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /></Button>
      </div>
    </div>
    <div className="grid sm:grid-cols-4 gap-4 border-b pb-4">
      {[['Total recorded', `${rows.reduce((s, r) => s + Number(r.litres), 0).toLocaleString()} L`], ['Latest per animal', last ? `${last.mlPerBird} ml` : '—'], ['Expected range', range ? `${range[0]}–${range[1]} ml` : '—'], ['Day-on-day change', delta !== null ? `${delta.toFixed(1)}%` : '—']].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}
    </div>
    {insights.length > 0 && <div className="space-y-2">
      <h4 className="font-medium">Insights</h4>
      {insights.map((i, k) => <div key={k} className={`flex gap-2 items-start rounded-md border p-3 text-sm ${i.tone === 'good' ? 'border-primary/40 bg-primary/5' : i.tone === 'warn' ? 'border-warning bg-warning/10' : 'bg-muted/40'}`}>
        {i.tone === 'good' ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" /> : i.tone === 'warn' ? <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" /> : <Info className="h-4 w-4 mt-0.5 shrink-0" />}<span>{i.text}</span></div>)}
      <p className="text-xs text-muted-foreground">Ranges are general guides for chickens; these are monitoring signals, not a diagnosis.</p>
    </div>}
    {delta !== null && Math.abs(delta) > 20 && <div className="border-l-4 border-warning bg-warning/10 p-4 text-sm">Water intake changed {delta.toFixed(1)}% per animal since yesterday. Check drinker flow, leaks, heat and flock health.</div>}
    <form onSubmit={save} className="space-y-3">
      <div className="flex items-center gap-2"><Switch id="water-range" checked={useRange} onCheckedChange={setUseRange} /><Label htmlFor="water-range">Record the same amount for a date range</Label></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {fields.map(([key, label, type]) => <div key={key}><Label htmlFor={`water-${key}`}>{label}</Label><Input id={`water-${key}`} type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} required={key !== 'temperature'} min={key === 'temperature' ? -10 : key === 'birds' ? 1 : key === 'endDate' ? form.date : type === 'number' ? 0.01 : undefined} max={key === 'temperature' ? 60 : type === 'date' ? today() : undefined} step={key === 'birds' ? 1 : 'any'} /></div>)}
      </div>
      <div><Label htmlFor="water-notes">Observation</Label><Textarea id="water-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      <Button disabled={busy}>{busy ? 'Saving…' : useRange ? `Save ${rangeDays.length} day${rangeDays.length === 1 ? '' : 's'}` : rows.some(r => r.date === form.date) ? 'Update water record' : 'Save water record'}</Button>
      {useRange && rangeDays.some(d => rows.some(r => r.date === d)) && <p className="text-xs text-muted-foreground">Days in this range that already have a record will be updated.</p>}
    </form>
    {chart.length > 0 && <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis />{range && <ReferenceArea y1={range[0]} y2={range[1]} fill="hsl(var(--primary))" fillOpacity={0.08} />}<Tooltip contentStyle={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }} /><Line dataKey="mlPerBird" name="ml per animal" stroke="hsl(var(--chart-2))" strokeWidth={2} /></LineChart></ResponsiveContainer></div>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-3">Date</th><th>Litres</th><th>Animals</th><th>ml/animal</th><th>Observation</th><th /></tr></thead><tbody>
      {[...chart].reverse().slice((page - 1) * 15, page * 15).map(r => <tr key={r.id} className="border-b"><td className="py-3 whitespace-nowrap">{r.date}</td><td>{r.litres}</td><td>{r.birds_at_record}</td><td>{r.mlPerBird}</td><td className="min-w-36">{r.notes || '—'}</td><td><Button variant="ghost" size="icon" title="Edit water record" onClick={() => { setUseRange(false); setForm({ date: r.date, endDate: r.date, litres: String(r.litres), birds: String(r.birds_at_record), temperature: r.temperature_c === null ? '' : String(r.temperature_c), notes: r.notes || '' }); }}><Pencil className="h-4 w-4" /></Button></td></tr>)}
    </tbody></table></div>
    {!rows.length && <p className="text-muted-foreground">No water consumption recorded yet.</p>}
    {rows.length > 15 && <div className="flex justify-end gap-3"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span>{page} / {Math.ceil(rows.length / 15)}</span><Button variant="outline" disabled={page * 15 >= rows.length} onClick={() => setPage(page + 1)}>Next</Button></div>}
  </section>;
}
