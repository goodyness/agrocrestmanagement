import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { DEFAULT_DELIVERY, money, podBlockers, unitLabel, variantTotal } from '@/lib/market';
import ShopHeader from '@/components/market/ShopHeader';
import { useMarketSettings } from './Shop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CreditCard, Loader2, Minus, Package, Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
export default function ShopCheckout() {
  const { cart, update, remove, clear } = useCart(); const nav = useNavigate();
  const settings = useMarketSettings();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [mode, setMode] = useState<'online' | 'pod'>('online'); const [busy, setBusy] = useState(false); const [redirecting, setRedirecting] = useState(false);
  const subtotal = cart.reduce((s, c) => s + variantTotal(c, c.quantity), 0);
  const delivery = Number(settings.data?.delivery_fee ?? DEFAULT_DELIVERY); const total = subtotal + delivery;
  const blockers = podBlockers(cart.map(c => ({ productName: c.product, allowPod: c.allowPod, podMinQuantity: c.podMinQuantity, quantity: c.quantity })), total, { enabled: settings.data?.pod_enabled ?? true, minTotal: settings.data?.pod_min_total == null ? null : Number(settings.data.pod_min_total) });
  const podOk = blockers.length === 0;
  async function place() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-checkout', { body: { customer, mode: podOk ? mode : 'online', items: cart.map(c => ({ variant_id: c.variantId, quantity: c.quantity })) } });
      if (error) { const ctx = (error as { context?: Response }).context; const body = ctx ? await ctx.json().catch(() => null) : null; throw new Error(body?.error || error.message); }
      if (data.authorization_url) { setRedirecting(true); clear(); window.location.assign(data.authorization_url); return; }
      clear();
      nav(`/shop/order?id=${data.order_id}&token=${data.token}&new=1`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Checkout failed'); setBusy(false); }
  }
  const summary = <aside className="rounded-xl border p-5 space-y-3 h-fit lg:sticky lg:top-24"><h2 className="font-semibold text-lg">Order summary</h2>{cart.map(c => <div key={c.variantId} className="flex justify-between text-sm gap-3"><span className="min-w-0 break-words">{c.product} · {c.variant} × {c.quantity}</span><span className="whitespace-nowrap">{money(variantTotal(c, c.quantity))}</span></div>)}<div className="border-t pt-3 text-sm space-y-1"><div className="flex justify-between"><span>Products</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span>Delivery</span><span>{money(delivery)}</span></div></div><div className="flex justify-between font-bold text-lg border-t pt-3"><span>Total</span><span>{money(total)}</span></div>{step === 3 && mode === 'online' && <p className="text-xs text-muted-foreground">Card/transfer processing fees are added by the payment provider and shown before you pay.</p>}</aside>;
  if (redirecting) return <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /><h1 className="text-xl font-semibold">Taking you to secure payment…</h1><p className="text-sm text-muted-foreground">Please don't close this page.</p></div>;
  if (!cart.length) return <div className="min-h-screen"><ShopHeader /><div className="container py-16 text-center space-y-4"><Package className="h-12 w-12 mx-auto text-muted-foreground" /><h1 className="text-2xl font-bold">Your basket is empty</h1><Button asChild><Link to="/shop">Browse products</Link></Button></div></div>;
  return <div className="min-h-screen bg-background"><ShopHeader />
    <main className="container px-4 py-6 sm:py-8 space-y-6 overflow-x-hidden"><Link to="/shop" className="inline-flex gap-2 items-center text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Continue shopping</Link>
      <ol className="flex gap-2 text-xs sm:text-sm">{['Basket', 'Delivery details', 'Payment'].map((s, i) => <li key={s} className={`flex-1 border-b-2 pb-2 ${step >= i + 1 ? 'border-primary font-semibold' : 'border-muted text-muted-foreground'}`}>{i + 1}. {s}</li>)}</ol>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] min-w-0">
        <section className="min-w-0">
          {step === 1 && <div className="space-y-4">{cart.map(c => <div key={c.variantId} className="flex gap-3 border rounded-lg p-3 items-center min-w-0"><div className="h-16 w-16 sm:h-20 sm:w-20 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">{c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-8 w-8 text-muted-foreground" />}</div><div className="flex-1 min-w-0"><p className="font-semibold truncate">{c.product}</p><p className="text-sm text-muted-foreground break-words">{c.variant}{c.unit === 'kg' ? ` · ${c.weight_kg}kg/bird` : ''} · {money(c.price)}/{c.unit}</p><div className="flex items-center gap-2 mt-2"><Button size="icon" variant="outline" className="h-8 w-8" aria-label="Decrease" disabled={c.quantity <= 1} onClick={() => update(c.variantId, c.quantity - 1)}><Minus className="h-3 w-3" /></Button><span className="w-8 text-center">{c.quantity}</span><Button size="icon" variant="outline" className="h-8 w-8" aria-label="Increase" disabled={c.quantity >= c.stock} onClick={() => update(c.variantId, c.quantity + 1)}><Plus className="h-3 w-3" /></Button><span className="text-xs text-muted-foreground">{unitLabel(c.unit, c.quantity)}</span></div></div><div className="text-right shrink-0"><p className="font-semibold text-sm sm:text-base whitespace-nowrap">{money(variantTotal(c, c.quantity))}</p><Button size="icon" variant="ghost" aria-label={`Remove ${c.product}`} onClick={() => remove(c.variantId)}><Trash2 className="h-4 w-4" /></Button></div></div>)}<Button onClick={() => setStep(2)} className="w-full sm:w-auto">Continue to delivery</Button></div>}
          {step === 2 && <form className="space-y-4" onSubmit={e => { e.preventDefault(); setStep(3); }}>
            <div><Label htmlFor="c-name">Full name</Label><Input id="c-name" required minLength={2} maxLength={150} value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} /></div>
            <div className="grid sm:grid-cols-2 gap-4"><div><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" required maxLength={150} value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></div><div><Label htmlFor="c-phone">Phone number</Label><Input id="c-phone" type="tel" required minLength={7} maxLength={30} value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} /></div></div>
            <div><Label htmlFor="c-address">Delivery address</Label><Textarea id="c-address" required minLength={10} maxLength={1000} value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} /></div>
            <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button><Button>Continue to payment</Button></div></form>}
          {step === 3 && <div className="space-y-4"><h2 className="text-xl font-semibold">How would you like to pay?</h2>
            <button type="button" onClick={() => setMode('online')} className={`w-full text-left rounded-xl border-2 p-4 flex gap-4 ${mode === 'online' || !podOk ? 'border-primary bg-primary/5' : 'border-border'}`}><CreditCard className="h-6 w-6 text-primary shrink-0" /><div><p className="font-semibold">Pay now</p><p className="text-sm text-muted-foreground">Pay securely with card, bank transfer or USSD via BursaPay. Your order is confirmed instantly.</p></div></button>
            <button type="button" disabled={!podOk} onClick={() => setMode('pod')} className={`w-full text-left rounded-xl border-2 p-4 flex gap-4 disabled:opacity-60 ${mode === 'pod' && podOk ? 'border-primary bg-primary/5' : 'border-border'}`}><Truck className="h-6 w-6 text-primary shrink-0" /><div><p className="font-semibold">Payment on delivery</p><p className="text-sm text-muted-foreground">Submit your order now and pay when it arrives. Farm bank account details will be in your confirmation email.</p>{!podOk && <ul className="text-sm text-destructive mt-2 list-disc pl-4">{blockers.map(b => <li key={b}>{b}</li>)}</ul>}{settings.data?.pod_note && podOk && <p className="text-xs mt-2">{settings.data.pod_note}</p>}</div></button>
            <div className="rounded-lg bg-muted p-3 text-sm break-words"><p className="font-medium">{customer.name} · {customer.phone}</p><p className="text-muted-foreground">{customer.email}</p><p className="text-muted-foreground">{customer.address}</p></div>
            <div className="flex flex-col-reverse sm:flex-row gap-3"><Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button><Button className="sm:flex-1 h-auto min-h-10 whitespace-normal" disabled={busy} onClick={place}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === 'pod' && podOk ? `Submit order · ${money(total)}` : `Pay ${money(total)} now`}</Button></div></div>}
        </section>{summary}</div></main></div>;
}
