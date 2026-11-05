import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, UserRoundCheck, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FarmManagersTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', preferences: '' });
  const managers = useQuery({ queryKey: ['farm-managers'], queryFn: async () => {
    const { data, error } = await supabase.from('farm_managers').select('*, profiles!farm_managers_profile_id_fkey(name,email)').order('onboarded_at', { ascending: false });
    if (error) throw error; return data;
  } });
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-farm-manager', { body: form });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Unable to create manager');
      toast.success(data.email_sent ? 'Manager created — welcome email sent' : 'Manager created, but email failed. Ask them to use Forgot password.');
      setOpen(false); setForm({ name: '', email: '', phone: '', preferences: '' }); await qc.invalidateQueries({ queryKey: ['farm-managers'] });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to create manager'); } finally { setSaving(false); }
  };
  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from('farm_managers').update({ active: !active }).eq('profile_id', id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ['farm-managers'] });
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3"><div className="flex items-center gap-2"><UserRoundCheck className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Farm Managers</h2><Badge variant="secondary">{managers.data?.length || 0}</Badge></div><Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Manager</Button></div>
    {managers.isLoading ? <p className="text-muted-foreground py-8">Loading managers…</p> : managers.isError ? <div role="alert"><p>Unable to load managers.</p><Button variant="outline" onClick={() => managers.refetch()}>Retry</Button></div> : !managers.data?.length ? <div className="text-center border-y py-16 text-muted-foreground"><UserRoundCheck className="h-10 w-10 mx-auto mb-3" /><p>No farm managers yet</p></div> : <div className="grid gap-4 md:grid-cols-2">{managers.data.map(m => <Card key={m.profile_id}><CardContent className="p-4 space-y-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold break-words">{m.profiles?.name}</h3><p className="text-sm text-muted-foreground break-all">{m.profiles?.email}</p>{m.phone && <p className="text-sm mt-1">{m.phone}</p>}</div><Badge variant={m.active ? 'secondary' : 'outline'}>{m.active ? 'Active' : 'Paused'}</Badge></div><p className="text-xs text-muted-foreground flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />Records from {format(new Date(m.onboarded_at), 'dd MMM yyyy, HH:mm')}</p>{m.preferences && <p className="text-sm whitespace-pre-wrap break-words">{m.preferences}</p>}<Button variant="outline" size="sm" onClick={() => toggle(m.profile_id, m.active)}>{m.active ? 'Pause access' : 'Restore access'}</Button></CardContent></Card>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>New Farm Manager</DialogTitle></DialogHeader><form onSubmit={create} className="space-y-4">{(['name', 'email', 'phone'] as const).map(key => <div key={key} className="space-y-2"><Label htmlFor={`manager-${key}`}>{key === 'name' ? 'Full name' : key === 'email' ? 'Email' : 'Phone'}</Label><Input id={`manager-${key}`} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} required={key !== 'phone'} maxLength={key === 'phone' ? 40 : key === 'name' ? 120 : 254} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}<div className="space-y-2"><Label htmlFor="manager-preferences">Preferences</Label><Textarea id="manager-preferences" maxLength={2000} value={form.preferences} onChange={e => setForm({ ...form, preferences: e.target.value })} /></div><Button type="submit" disabled={saving} className="w-full">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{saving ? 'Creating…' : 'Create & send welcome email'}</Button></form></DialogContent></Dialog>
  </div>;
}