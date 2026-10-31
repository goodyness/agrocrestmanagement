import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { initializePayment } from '../_shared/bursapay.ts';
import { orderLink, safeOrigin, sendBookingEmails, type Order } from '../_shared/market-mail.ts';
const respond = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const Body = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(150), email: z.string().trim().email().max(150), phone: z.string().trim().min(7).max(30), address: z.string().trim().min(10).max(1000) }),
  items: z.array(z.object({ variant_id: z.string().uuid(), quantity: z.number().int().min(1).max(100000) })).min(1).max(30),
  mode: z.enum(['online', 'pod']),
});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405);
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return respond({ error: 'Please check your details and basket', fields: parsed.error.flatten().fieldErrors }, 400);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const origin = safeOrigin(req);
    const { customer, items, mode } = parsed.data;
    const { data: created, error } = await db.rpc('market_create_order', { _customer: customer, _items: items, _mode: mode });
    if (error) return respond({ error: error.message }, 400);
    const id = (created as { id: string }).id;
    const load = async () => (await db.from('market_orders').select('*').eq('id', id).single()).data as Order;
    if (mode === 'pod') {
      await db.rpc('market_settle_stock', { _id: id });
      const order = await load();
      const emailed = await sendBookingEmails(db, order, origin);
      return respond({ mode, order_id: id, token: order.access_token, order_number: order.order_number, emailed });
    }
    const order = await load();
    try {
      const pay = await initializePayment({ amount: Number(order.total), email: order.email, callback_url: orderLink(origin, order), order_id: id, order_number: order.order_number, attempt: 1 });
      await db.from('market_orders').update({ provider_reference: pay.reference, provider_fee: Math.max(0, Number(pay.amount) - Number(order.total)), amount_charged: Number(pay.amount) }).eq('id', id);
      return respond({ mode, order_id: id, token: order.access_token, order_number: order.order_number, authorization_url: pay.authorization_url, amount: Number(pay.amount), fees: Math.max(0, Number(pay.amount) - Number(order.total)) });
    } catch (e) {
      await db.from('market_orders').update({ payment_status: 'failed', admin_note: 'Payment could not start' }).eq('id', id);
      return respond({ error: `Online payment could not start: ${e instanceof Error ? e.message : 'unknown error'}` }, 502);
    }
  } catch (e) { console.error(e); return respond({ error: 'Checkout failed. Please try again.' }, 500); }
});
