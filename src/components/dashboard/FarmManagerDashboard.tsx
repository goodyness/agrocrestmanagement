import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Egg, Receipt, ShoppingBasket, StickyNote, Sprout, LogOut, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { managerMetrics, type ManagerProduction, type ManagerSale, type ManagerExpense } from '@/lib/managerMetrics';
import { money } from '@/lib/market';
import ManagerNotes from './manager/ManagerNotes';

async function fetchAll<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await read(offset, offset + 999); if (error) throw new Error(error.message);
    const rows = data as T[]; out.push(...rows); if (rows.length < 1000) return out;
  }
}
function Pagination({ count, page, change }: { count: number; page: number; change: (page: number) => void }) {
  if (count <= 15) return null;
  return <div className="flex items-center justify-end gap-3 pt-4"><Button size="sm" variant="outline" disabled={!page} onClick={() => change(page - 1)}>Previous</Button><span className="text-xs">{page + 1} / {Math.ceil(count / 15)}</span><Button size="sm" variant="outline" disabled={(page + 1) * 15 >= count} onClick={() => change(page + 1)}>Next</Button></div>;
}
export default function FarmManagerDashboard({ user }: { user: User | null }) {
  const [tab, setTab] = useState('production'); const [pages, setPages] = useState({ production: 0, sales: 0, expenses: 0 });
  const access = useQuery({ queryKey: ['manager-access', user?.id], enabled: Boolean(user), queryFn: async () => {
    if (!user) throw new Error('Sign in required');
    const { data, error } = await supabase.from('farm_managers').select('*,profiles!farm_managers_profile_id_fkey(name)').eq('profile_id', user.id).single();
    if (error) throw error; return data;
  } });
  const records = useQuery({ queryKey: ['manager-records', user?.id, access.data?.onboarded_at], enabled: Boolean(access.data?.active), queryFn: async () => {
    const cutoff = access.data?.onboarded_at; if (!cutoff) throw new Error('Onboarding not found');
    const [daily, batch, sales, expenses] = await Promise.all([
      fetchAll<ManagerProduction>((a,b) => supabase.from('daily_production').select('id,date,created_at,crates,pieces,egg_type,comment').gte('created_at', cutoff).order('created_at', { ascending: false }).order('id').range(a,b)),
      fetchAll<ManagerProduction>((a,b) => supabase.from('batch_egg_production').select('id,date,created_at,crates,pieces,cracked_pieces,notes').gte('created_at', cutoff).order('created_at', { ascending: false }).order('id').range(a,b)),
      fetchAll<ManagerSale>((a,b) => supabase.from('sales_records').select('id,date,created_at,product_name,quantity,unit,total_amount,buyer_name,payment_status').gte('created_at', cutoff).order('created_at', { ascending: false }).order('id').range(a,b)),
      fetchAll<ManagerExpense>((a,b) => supabase.from('miscellaneous_expenses').select('id,date,created_at,expense_type,amount,description').gte('created_at', cutoff).order('created_at', { ascending: false }).order('id').range(a,b)),
    ]);
    return { production: [...daily, ...batch].sort((a,b) => b.created_at.localeCompare(a.created_at)), sales, expenses };
  } });
  const totals = managerMetrics(records.data?.production || [], records.data?.sales || [], records.data?.expenses || []);
  const fmt = (d: string) => format(new Date(`${d}T12:00:00`), 'dd MMM yyyy');
  const metrics = [{ label: 'Total eggs laid', value: totals.eggs.toLocaleString(), sub: `${totals.good.toLocaleString()} good · ${totals.cracked.toLocaleString()} cracked`, icon: Egg }, { label: 'Total sales', value: money(totals.sales), sub: `${records.data?.sales.length || 0} records`, icon: ShoppingBasket }, { label: 'Total expenses', value: money(totals.expenses), sub: `${records.data?.expenses.length || 0} records`, icon: Receipt }];
  return <div className="min-h-screen bg-background"><header className="border-b bg-card"><div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><Sprout className="h-7 w-7 text-primary shrink-0" /><div className="min-w-0"><h1 className="font-semibold text-lg">Agrocrest Farm</h1><p className="text-xs text-muted-foreground truncate">Farm Manager · {access.data?.profiles?.name || 'Welcome'}</p></div></div><Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut className="h-5 w-5" /></Button></div></header>
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 min-w-0">
      <div className="flex justify-between items-start gap-3"><div><h2 className="text-2xl font-semibold">Farm overview</h2>{access.data && <p className="text-xs text-muted-foreground mt-2">From {format(new Date(access.data.onboarded_at), 'dd MMM yyyy, HH:mm')} · Read-only records</p>}</div><Button size="icon" variant="outline" title="Refresh records" aria-label="Refresh records" onClick={() => { access.refetch(); records.refetch(); }}><RefreshCw className="h-4 w-4" /></Button></div>
      {access.isLoading || (access.data?.active && records.isLoading) ? <div className="py-16 text-center text-muted-foreground">Loading your farm overview…</div> : access.isError || records.isError ? <div role="alert" className="border-y py-8"><p>Unable to load your records.</p><Button variant="outline" onClick={() => { access.refetch(); records.refetch(); }}>Retry</Button></div> : !access.data?.active ? <div className="py-12 text-center">Your manager access is paused. Contact the farm admin.</div> : <>
      <div className="grid gap-3 sm:grid-cols-3">{metrics.map(m => <Card key={m.label}><CardContent className="p-4 sm:p-5"><div className="flex justify-between items-center gap-2"><span className="text-sm text-muted-foreground">{m.label}</span><m.icon className="h-5 w-5 text-primary" /></div><p className="text-xl sm:text-2xl font-semibold mt-3 break-words">{m.value}</p><p className="text-xs text-muted-foreground mt-2">{m.sub}</p></CardContent></Card>)}</div>
      <section className="border-y py-5"><h3 className="font-semibold mb-4">Monthly egg production</h3>{!totals.months.length ? <p className="text-sm text-muted-foreground py-8 text-center">No production recorded since onboarding</p> : <><div className="h-56 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={totals.months}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis width={45} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="eggs" name="Eggs laid" fill="hsl(var(--primary))" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{totals.months.map(m => <div key={m.month} className="border-b pb-3 text-sm"><p className="font-medium">{format(new Date(`${m.month}-01T12:00:00`), 'MMMM yyyy')}</p><p className="mt-1">{m.eggs.toLocaleString()} eggs</p><p className="text-xs text-muted-foreground mt-1">Sales {money(m.sales)} · Expenses {money(m.expenses)}</p></div>)}</div></>}</section>
      <Tabs value={tab} onValueChange={setTab}><TabsList className="grid grid-cols-4 w-full h-auto gap-1">{[{ key:'production', label:'Production', icon:Egg }, { key:'expenses', label:'Expenses', icon:Receipt }, { key:'sales', label:'Sales', icon:ShoppingBasket }, { key:'notes', label:'Notes', icon:StickyNote }].map(t => <TabsTrigger key={t.key} value={t.key} className="px-1 py-2 flex flex-col sm:flex-row gap-1 sm:gap-2 text-xs sm:text-sm"><t.icon className="h-4 w-4" />{t.label}</TabsTrigger>)}</TabsList>
      <TabsContent value="production"><h3 className="text-lg font-semibold py-3">Production records</h3>{!records.data?.production.length ? <p className="text-muted-foreground py-10 text-center">No production records yet</p> : <div className="divide-y">{records.data.production.slice(pages.production*15,pages.production*15+15).map(r => <div key={r.id} className="py-4 flex gap-3 justify-between"><div className="min-w-0"><p className="font-medium text-sm">{fmt(r.date)}</p><p className="text-xs text-muted-foreground mt-1 break-words">{r.comment || r.notes || 'No note'}</p></div><div className="text-right shrink-0 text-sm"><p>{r.crates} crates · {r.pieces} pieces</p><p className="text-xs text-muted-foreground">{r.egg_type === 'cracked' ? 'Cracked eggs' : `${r.cracked_pieces || 0} cracked pieces`}</p></div></div>)}</div>}<Pagination count={records.data?.production.length || 0} page={pages.production} change={p => setPages({ ...pages, production:p })} /></TabsContent>
      <TabsContent value="expenses"><h3 className="text-lg font-semibold py-3">Expense records</h3>{!records.data?.expenses.length ? <p className="text-muted-foreground py-10 text-center">No expense records yet</p> : <div className="divide-y">{records.data.expenses.slice(pages.expenses*15,pages.expenses*15+15).map(r => <div key={r.id} className="py-4 flex gap-3 justify-between"><div className="min-w-0"><p className="font-medium text-sm break-words">{r.expense_type}</p><p className="text-xs text-muted-foreground mt-1">{fmt(r.date)}</p><p className="text-sm mt-2 break-words">{r.description || 'No note'}</p></div><p className="font-semibold text-sm text-right">{money(r.amount)}</p></div>)}</div>}<Pagination count={records.data?.expenses.length || 0} page={pages.expenses} change={p => setPages({ ...pages, expenses:p })} /></TabsContent>
      <TabsContent value="sales"><h3 className="text-lg font-semibold py-3">Sales records</h3>{!records.data?.sales.length ? <p className="text-muted-foreground py-10 text-center">No sales records yet</p> : <div className="divide-y">{records.data.sales.slice(pages.sales*15,pages.sales*15+15).map(r => <div key={r.id} className="py-4 flex gap-3 justify-between"><div className="min-w-0"><p className="font-medium text-sm break-words">{r.product_name}</p><p className="text-xs text-muted-foreground mt-1">{fmt(r.date)} · {r.quantity} {r.unit}</p><p className="text-sm mt-2 break-words">{r.buyer_name}</p></div><div className="text-right text-sm"><p className="font-semibold">{money(r.total_amount)}</p><p className="text-xs text-muted-foreground mt-1 capitalize">{r.payment_status}</p></div></div>)}</div>}<Pagination count={records.data?.sales.length || 0} page={pages.sales} change={p => setPages({ ...pages, sales:p })} /></TabsContent>
      <TabsContent value="notes">{user && <ManagerNotes userId={user.id} />}</TabsContent></Tabs>
      </>}
    </main></div>;
}