import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { sendSmtp } from '../_shared/smtp.ts';

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().max(40).default(''), preferences: z.string().trim().max(2000).default('') });
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Service unavailable' }, 503);
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await db.auth.getUser((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    if (authError || !auth.user) return json({ error: 'Sign in required' }, 401);
    const { data: role } = await db.from('user_roles').select('role').eq('user_id', auth.user.id).eq('role', 'admin').maybeSingle();
    if (!role) return json({ error: 'Admin access required' }, 403);
    const input = schema.safeParse(await req.json());
    if (!input.success) return json({ error: 'Enter a valid name, email, phone and preferences' }, 400);
    if (!Deno.env.get('GMAIL_USER') || !Deno.env.get('GMAIL_APP_PASSWORD')) return json({ error: 'Farm email service is not configured' }, 503);
    const { name, phone, preferences } = input.data; const email = input.data.email.toLowerCase();
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const password = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') + 'Aa!9';
    // Do not link or overwrite an existing admin/worker/partner account.
    const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
    if (createError || !created.user) return json({ error: createError?.message || 'Unable to create manager' }, 400);
    const id = created.user.id;
    try {
      const { error: profileError } = await db.from('profiles').update({ name, email, phone: phone || null }).eq('id', id);
      if (profileError) throw profileError;
      const { data: manager, error: managerError } = await db.from('farm_managers').insert({ profile_id: id, created_by: auth.user.id, phone: phone || null, preferences }).select().single();
      if (managerError) throw managerError;
      const { error: roleError } = await db.from('user_roles').insert({ user_id: id, role: 'farm_manager' });
      if (roleError) throw roleError;
      const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#243b2d"><div style="max-width:560px;margin:auto;padding:24px"><div style="background:#1f5130;color:#ffffff;padding:24px"><h1 style="font-size:22px;margin:0">Welcome to Agrocrest Farm</h1><p>Farm Manager Account</p></div><div style="border:1px solid #dce7df;padding:24px"><p>Hello ${esc(name)},</p><p>Your farm manager account is ready. You can view egg production, expenses and sales recorded from your onboarding onward, and keep your personal notes.</p><table style="width:100%;background:#f4f8f5;padding:16px"><tr><td>Email</td><td>${esc(email)}</td></tr><tr><td>Temporary password</td><td style="word-break:break-all">${esc(password)}</td></tr></table><p><a href="https://agrocrestfarm.app/auth" style="display:inline-block;padding:12px 20px;background:#1f5130;color:#ffffff;text-decoration:none">Sign in</a></p><p>Use Forgot password to replace your temporary password before continuing.</p><p style="font-size:12px;color:#657a6b">This is an automated message from Agrocrest Farm.</p></div></div></body></html>`;
      let emailSent = true;
      try { await sendSmtp(email, 'Welcome to Agrocrest - Farm Manager Account', html, `Hello ${name}, sign in at https://agrocrestfarm.app/auth. Email: ${email}. Temporary password: ${password}. Use Forgot password to replace it.`); }
      catch { emailSent = false; console.warn('Manager welcome email could not be delivered'); }
      return json({ success: true, manager, email_sent: emailSent });
    } catch {
      await db.auth.admin.deleteUser(id);
      return json({ error: 'Unable to finish manager setup; no manager account was retained' }, 500);
    }
  } catch { return json({ error: 'Unable to process manager invitation' }, 500); }
});