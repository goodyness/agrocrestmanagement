import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { money } from '@/lib/market';
import ShopHeader from '@/components/market/ShopHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
type PubOrder = { order_number: string; customer_name: string; delivery_address: string; items: { product: string; variant: string; quantity: number; line_total: number }[]; subtotal: number; delivery_fee: number; total: number; amount_charged: number | null; payment_status: string; payment_mode: string; status: string; created_at: string };
const STEPS = ['pending', 'processing', 'dispatched', 'delivered'];
export default function ShopOrder() {
  const [params] = useSearchParams(); const id = params.get('id'); const token = params.get('token');
  const [paying, setPaying] = useState(false);
  const q = useQuery({ queryKey: ['shop-order', id], enabled: !!id && !!token, refetchInterval: d => { const o = (d.state.data as PubOrder | undefined); return o && o.payment_mode === 'online' && o.payment_status === 'awaiting_payment' ? 5000 : false; }, queryFn: async () => { const { data, error } = await supabase.functions.invoke('market-order', { body: { id, token } }); if (error) throw error; return data.order as PubOrder; } });
  async function payAgain() { setPaying(true); const { data, error } = await supabase.functions.invoke('market-order', { body: { id, token, action: 'pay' } }); if (error || !data?.authorization_url) { toast.error('Could not start payment'); setPaying(false); return; } window.location.href = data.authorization_url; }
  const o = q.data;
  return <div className="min-h-screen bg-background"><ShopHeader /><main className="container max-w-2xl py-10 space-y-6">
    {!id || !token ? <p>Invalid order link.</p> : q.isLoading ? <p className="flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin" />Checking your order and payment…</p> : !o ? <p className="text-destructive">Order not found.</p> : <>
      <div className="text-center space-y-3">{o.status === 'cancelled' || o.payment_status === 'failed' ? <XCircle className="h-14 w-14 mx-auto text-destructive" /> : o.payment_status === 'paid' || o.payment_mode === 'pod' ? <CheckCircle2 className="h-14 w-14 mx-auto text-success" /> : <Clock className="h-14 w-14 mx-auto text-warning" />}
        <h1 className="text-3xl font-bold">{o.status === 'cancelled' ? 'Order cancelled' : o.payment_status === 'paid' ? 'Payment confirmed' : o.payment_mode === 'pod' ? 'Order submitted' : o.payment_status === 'failed' ? 'Payment not completed' : 'Waiting for payment'}</h1>
        <p className="text-muted-foreground">Order <b>{o.order_number}</b> · {new Date(o.created_at).toLocaleString()}</p>
        <div className="flex justify-center gap-2"><Badge variant="secondary">{o.payment_mode === 'pod' ? 'Payment on delivery' : 'Online payment'}</Badge><Badge variant={o.payment_status === 'paid' ? 'default' : 'outline'}>{o.payment_status === 'paid' ? 'Paid' : o.payment_status === 'failed' ? 'Failed' : 'Unpaid'}</Badge></div>
        {o.payment_mode === 'pod' && o.payment_status !== 'paid' && <p className="text-sm">Please pay {money(o.total)} on delivery. Farm bank account details have been sent to your email.</p>}
        {o.payment_mode === 'online' && o.payment_status !== 'paid' && o.status !== 'cancelled' && <Button onClick={payAgain} disabled={paying}>{paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete payment</Button>}
      </div>
      {o.status !== 'cancelled' && <ol className="grid grid-cols-4 gap-2 text-xs text-center">{STEPS.map((s, i) => <li key={s} className={`border-t-4 pt-2 capitalize ${STEPS.indexOf(o.status) >= i ? 'border-primary font-semibold' : 'border-muted text-muted-foreground'}`}>{s === 'pending' ? 'Received' : s}</li>)}</ol>}
      <section className="rounded-xl border p-5 space-y-2">{o.items.map((l, i) => <div key={i} className="flex justify-between text-sm"><span>{l.product} · {l.variant} × {l.quantity}</span><span>{money(l.line_total)}</span></div>)}<div className="border-t pt-2 text-sm flex justify-between"><span>Delivery</span><span>{money(o.delivery_fee)}</span></div><div className="flex justify-between font-bold"><span>Total</span><span>{money(o.total)}</span></div>{o.amount_charged && o.amount_charged > o.total && o.payment_status === 'paid' && <p className="text-xs text-muted-foreground">Charged {money(o.amount_charged)} including payment fees.</p>}<p className="text-sm text-muted-foreground pt-2">Deliver to: {o.delivery_address}</p></section>
      <p className="text-sm text-muted-foreground text-center">Save this page link to track your order. You’ll get an email at every step.</p>
      <div className="text-center"><Button variant="outline" asChild><Link to="/shop">Continue shopping</Link></Button></div>
    </>}
  </main></div>;
}
