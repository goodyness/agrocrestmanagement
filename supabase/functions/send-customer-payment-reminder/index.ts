import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { z } from 'npm:zod@3';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return respond({ error: 'Email service unavailable' }, 503);
    const db = createClient(url, key);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /i, '');
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return respond({ error: 'Sign in required' }, 401);
    const caller = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: admin, error: roleError } = await caller.rpc('is_admin');
    if (roleError || !admin) return respond({ error: 'Administrator access required' }, 403);
    const parsed = z.object({ saleId: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return respond({ error: 'A valid sale is required' }, 400);
    const { data: sale, error: saleError } = await db.from('sales_records').select('id,customer_id,total_amount,amount_paid,payment_status,date,product_name,quantity,unit').eq('id', parsed.data.saleId).single();
    if (saleError || !sale?.customer_id) return respond({ error: 'Sale must be linked to a customer' }, 400);
    const { data: customer, error: customerError } = await db.from('customers').select('id,name,email,payment_terms_days').eq('id', sale.customer_id).single();
    if (customerError || !customer || !z.string().email().safeParse(customer.email).success) return respond({ error: 'Add a valid customer email first' }, 400);
    const owed = Math.max(0, Number(sale.total_amount) - (sale.payment_status === 'paid' ? Number(sale.total_amount) : Number(sale.amount_paid || 0)));
    if (owed <= 0) return respond({ error: 'This sale is already fully paid' }, 400);
    const gmailUser = Deno.env.get('GMAIL_USER'); const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!gmailUser || !gmailPassword) return respond({ error: 'SMTP email is not configured' }, 503);
    const { data: log, error: logError } = await db.from('customer_payment_reminders').insert({ sale_id: sale.id, customer_id: customer.id, sent_by: user.id }).select('id').single();
    if (logError || !log) return respond({ error: 'A reminder was already sent or is being sent for this sale today' }, 409);
    const amount = `NGN ${owed.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const due = new Date(`${sale.date}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + Number(customer.payment_terms_days));
    const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser, password: gmailPassword } } });
    try {
      await client.send({ from: `Agrocrest Farm <${gmailUser}>`, to: customer.email, subject: `Payment reminder • ${sale.product_name}`, content: `Hello ${customer.name}, your remaining balance for ${sale.quantity} ${sale.unit} of ${sale.product_name} purchased on ${sale.date} is ${amount}. Payment due: ${due.toISOString().slice(0,10)}. Please reply to this email to arrange payment or clarify an already completed payment. Thank you, Agrocrest Farm.`, html: `<div style="background:#ffffff;font-family:Arial,sans-serif;color:#172b20;max-width:600px;margin:auto;border:1px solid #dce5df"><div style="background:#173e2a;padding:28px;color:#ffffff"><p style="margin:0;font-size:13px">AGROCREST FARM</p><h1 style="font-size:26px;margin-bottom:0">Payment reminder</h1></div><div style="padding:28px"><p>Hello ${escape(customer.name)},</p><p>This is a friendly reminder about the remaining payment for your purchase.</p><div style="background:#f1f6f3;padding:22px"><p style="margin-top:0">Outstanding balance</p><strong style="font-size:30px">${amount}</strong></div><p><b>Goods:</b> ${escape(sale.product_name)} (${Number(sale.quantity)} ${escape(sale.unit)})<br><b>Purchase date:</b> ${escape(sale.date)}<br><b>Payment due:</b> ${due.toISOString().slice(0,10)}<br><b>Reference:</b> ${sale.id.slice(0,8).toUpperCase()}</p><p>Please reply to this email to arrange payment. If you have already paid, kindly send us your payment reference so we can update your record.</p><p>Thank you,<br><b>Agrocrest Farm</b></p></div></div>` });
      const { error: sentError } = await db.from('customer_payment_reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', log.id);
      if (sentError) return respond({ success: true, warning: 'Email sent; delivery history update failed' });
    } catch {
      await db.from('customer_payment_reminders').delete().eq('id', log.id);
      return respond({ error: 'Could not send the reminder. Please retry.' }, 502);
    } finally { await client.close(); }
    return respond({ success: true });
  } catch { return respond({ error: 'Could not process the reminder' }, 500); }
});