import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { safeOrigin, sendStatusEmail, type Order } from '../_shared/market-mail.ts';
const respond = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!; const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /i, '');
    const db = createClient(url, key);
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return respond({ error: 'Sign in required' }, 401);
    const { data: role } = await db.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!role) return respond({ error: 'Administrator access required' }, 403);
    const parsed = z.object({ id: z.string().uuid(), event: z.enum(['status', 'paid']) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return respond({ error: 'Invalid request' }, 400);
    const { data: o } = await db.from('market_orders').select('*').eq('id', parsed.data.id).maybeSingle();
    if (!o) return respond({ error: 'Order not found' }, 404);
    await sendStatusEmail(db, o as Order, safeOrigin(req), parsed.data.event);
    return respond({ success: true });
  } catch (e) { console.error(e); return respond({ error: 'Email could not be sent' }, 502); }
});
