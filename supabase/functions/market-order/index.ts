import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { initializePayment, isFailedStatus, isPaidStatus, verifyPayment } from '../_shared/bursapay.ts';
import { orderLink, safeOrigin, sendBookingEmails, type Order } from '../_shared/market-mail.ts';
const respond = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const Body = z.object({ id: z.string().uuid(), token: z.string().uuid(), action: z.enum(['status', 'pay']).default('status') });
const pub = (o: Order) => ({ order_number: o.order_number, customer_name: o.customer_name, delivery_address: o.delivery_address, items: o.items, subtotal: o.subtotal, delivery_fee: o.delivery_fee, total: o.total, amount_charged: o.amount_charged, payment_status: o.payment_status, payment_mode: o.payment_mode, status: o.status, created_at: o.created_at });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return respond({ error: 'Invalid order link' }, 400);
    const { id, token, action } = parsed.data;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const origin = safeOrigin(req);
    const get = async () => (await db.from('market_orders').select('*').eq('id', id).eq('access_token', token).maybeSingle()).data as (Order & { provider_reference: string | null }) | null;
    let o = await get();
    if (!o) return respond({ error: 'Order not found' }, 404);
    // Verify with BursaPay server-side; never trust the redirect alone.
    if (o.payment_mode === 'online' && o.payment_status !== 'paid' && o.provider_reference) {
      try {
        const v = await verifyPayment(o.provider_reference);
        const base = Number(v.base_amount ?? v.amount);
        if (isPaidStatus(v.status) && base + 0.005 >= Number(o.total) && (!v.metadata?.order_id || v.metadata.order_id === id)) {
          const { data: upd } = await db.from('market_orders').update({ payment_status: 'paid', paid_at: v.paid_at || new Date().toISOString() }).eq('id', id).neq('payment_status', 'paid').select('id');
          if (upd?.length) { await db.rpc('market_settle_stock', { _id: id }); o = (await get())!; await sendBookingEmails(db, o, origin); }
        } else if (isFailedStatus(v.status) && o.payment_status !== 'failed') {
          await db.from('market_orders').update({ payment_status: 'failed' }).eq('id', id);
        }
      } catch (e) { console.error('verify', e); }
      o = (await get())!;
    }
    if (action === 'pay') {
      if (o.payment_mode !== 'online' || o.payment_status === 'paid' || o.status === 'cancelled') return respond({ error: 'This order cannot be paid online' }, 400);
      const pay = await initializePayment({ amount: Number(o.total), email: o.email, callback_url: orderLink(origin, o), order_id: id, order_number: o.order_number, attempt: Date.now() });
      await db.from('market_orders').update({ provider_reference: pay.reference, payment_status: 'awaiting_payment', amount_charged: Number(pay.amount), provider_fee: Math.max(0, Number(pay.amount) - Number(o.total)) }).eq('id', id);
      return respond({ authorization_url: pay.authorization_url });
    }
    return respond({ order: pub(o) });
  } catch (e) { console.error(e); return respond({ error: e instanceof Error ? e.message : 'Could not load order' }, 500); }
});
