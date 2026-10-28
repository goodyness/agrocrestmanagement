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
    const parsed = z.object({ customerId: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return respond({ error: 'A valid customer is required' }, 400);
    const { data: customer, error: customerError } = await db.from('customers').select('id,name,email,payment_terms_days').eq('id', parsed.data.customerId).single();
    if (customerError || !customer || !z.string().email().safeParse(customer.email).success) return respond({ error: 'Add a valid customer email first' }, 400);
    const { data: allSales } = await db.from('sales_records').select('id,total_amount,amount_paid,payment_status,date,product_name,quantity,unit').eq('customer_id', customer.id).order('date');
    const terms = Number(customer.payment_terms_days || 0);
    const items = (allSales || []).map(s => {
      const owed = Math.max(0, Number(s.total_amount) - (s.payment_status === 'paid' ? Number(s.total_amount) : Number(s.amount_paid || 0)));
      const due = new Date(`${s.date}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + terms);
      return { ...s, owed, due: due.toISOString().slice(0, 10) };
    }).filter(s => s.owed > 0);
    if (!items.length) return respond({ error: 'This customer has no unpaid balance' }, 400);
    const gmailUser = Deno.env.get('GMAIL_USER'); const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!gmailUser || !gmailPassword) return respond({ error: 'SMTP email is not configured' }, 503);
    const logIds: string[] = [];
    for (const s of items) {
      const { data: log } = await db.from('customer_payment_reminders').insert({ sale_id: s.id, customer_id: customer.id, sent_by: user.id }).select('id').single();
      if (log) logIds.push(log.id);
    }
    if (!logIds.length) return respond({ error: 'A reminder was already sent to this customer today' }, 409);
    const fmt = (n: number) => `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const totalOwed = items.reduce((a, s) => a + s.owed, 0);
    const today = new Date().toISOString().slice(0, 10);
    const reference = customer.id.slice(0, 8).toUpperCase();
    const { data: banks } = await db.from('bank_accounts').select('bank_name,account_name,account_number').eq('is_active', true).order('bank_name');
    const bankList = (banks || []) as { bank_name: string; account_name: string; account_number: string }[];
    const bankText = bankList.length ? ` You can pay into any of these accounts: ${bankList.map(b => `${b.bank_name} - ${b.account_number} (${b.account_name})`).join('; ')}.` : '';
    const bankHtml = bankList.length ? `<p style="margin-bottom:8px"><b>Pay into any of these accounts:</b></p><table style="width:100%;border-collapse:collapse;font-size:14px">${bankList.map(b => `<tr><td style="padding:10px;border:1px solid #dce5df"><b>${escape(b.bank_name)}</b><br>${escape(b.account_name)}</td><td style="padding:10px;border:1px solid #dce5df;font-family:monospace;font-size:17px;letter-spacing:1px">${escape(b.account_number)}</td></tr>`).join('')}</table><p style="font-size:13px;color:#53685b">Please use reference <b>${reference}</b> as your payment narration.</p>` : '';
    const td = 'padding:8px;border-bottom:1px solid #dce5df';
    const rows = items.map(s => `<tr><td style="${td}">${escape(s.date)}</td><td style="${td}">${escape(s.product_name)}<br><span style="color:#53685b;font-size:12px">${Number(s.quantity)} ${escape(s.unit)} · Ref ${s.id.slice(0,8).toUpperCase()}</span></td><td style="${td};text-align:right">${fmt(Number(s.total_amount))}</td><td style="${td};text-align:right"><b>${fmt(s.owed)}</b><br><span style="font-size:12px;color:${s.due < today ? '#b42318' : '#53685b'}">Due ${s.due}${s.due < today ? ' (overdue)' : ''}</span></td></tr>`).join('');
    const tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0"><thead><tr style="background:#f1f6f3;text-align:left"><th style="${td}">Date</th><th style="${td}">Goods</th><th style="${td};text-align:right">Total</th><th style="${td};text-align:right">Balance</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3" style="padding:10px;text-align:right"><b>Total outstanding</b></td><td style="padding:10px;text-align:right"><b>${fmt(totalOwed)}</b></td></tr></tfoot></table>`;
    const lineText = items.map(s => `- ${s.date}: ${s.quantity} ${s.unit} of ${s.product_name}, balance ${fmt(s.owed)} (due ${s.due})`).join('\n');
    const notice = 'This is an automated message from Agrocrest Farm.';
    const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser, password: gmailPassword } } });
    try {
      await client.send({ from: `Agrocrest Farm <${gmailUser}>`, to: customer.email, subject: `Payment reminder • ${items.length} unpaid purchase${items.length > 1 ? 's' : ''} • ${fmt(totalOwed)}`, content: `Hello ${customer.name}, you have ${items.length} unpaid purchase(s) with a total outstanding balance of ${fmt(totalOwed)}:\n${lineText}\n${bankText} Please use reference ${reference}. Reply to this email to arrange payment or clarify an already completed payment. Thank you, Agrocrest Farm. ${notice}`, html: `<div style="background:#ffffff;font-family:Arial,sans-serif;color:#172b20;max-width:640px;margin:auto;border:1px solid #dce5df"><div style="background:#173e2a;padding:28px;color:#ffffff"><p style="margin:0;font-size:13px">AGROCREST FARM</p><h1 style="font-size:26px;margin-bottom:0">Payment reminder</h1></div><div style="padding:28px"><p>Hello ${escape(customer.name)},</p><p>This is a friendly reminder about the remaining payment on ${items.length} purchase${items.length > 1 ? 's' : ''} on your account.</p><div style="background:#f1f6f3;padding:22px"><p style="margin-top:0">Total outstanding balance</p><strong style="font-size:30px">${fmt(totalOwed)}</strong></div>${tableHtml}${bankHtml}<p>Please reply to this email to arrange payment. If you have already paid, kindly send us your payment reference so we can update your record.</p><p>Thank you,<br><b>Agrocrest Farm</b></p></div><div style="background:#f1f6f3;padding:16px 28px;font-size:12px;color:#53685b;border-top:1px solid #dce5df">${notice} It was sent because a balance is recorded on your account. Replies to this address are read by our team.</div></div>` });
      const { error: sentError } = await db.from('customer_payment_reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', logIds);
      if (sentError) return respond({ success: true, count: items.length, warning: 'Email sent; delivery history update failed' });
    } catch {
      await db.from('customer_payment_reminders').delete().in('id', logIds);
      return respond({ error: 'Could not send the reminder. Please retry.' }, 502);
    } finally { await client.close(); }
    return respond({ success: true, count: items.length, total: totalOwed });
  } catch { return respond({ error: 'Could not process the reminder' }, 500); }
});