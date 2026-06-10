import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function genPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out + "!2";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", userData.user.id).single();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden — admins only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { name, email, phone, notes, branch_id } = body || {};
    if (!name || !email) {
      return new Response(JSON.stringify({ error: "Name and email are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const password = genPassword(10);

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "partner" },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ensure profile row is partner role + name (+ branch)
    await admin.from("profiles").upsert({ id: created.user.id, name, role: "partner", email, branch_id: branch_id || null });

    // Insert partner row
    const { data: partnerRow, error: pErr } = await admin
      .from("partners")
      .insert({ profile_id: created.user.id, phone: phone || null, notes: notes || null, branch_id: branch_id || null, created_by: userData.user.id })
      .select()
      .single();
    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send styled welcome email via Gmail SMTP
    try {
      const gmailUser = Deno.env.get("GMAIL_USER")!;
      const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD")!;
      const smtp = new SMTPClient({
        connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
      });

      const appUrl = req.headers.get("origin") || "https://agrocrestmanagement.lovable.app";
      const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;color:#1f2a1c;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#3f6f3a,#86a96b);padding:28px 32px;color:#fff;">
      <h1 style="margin:0;font-size:22px;">🌾 Welcome to Agrocrest Farm</h1>
      <p style="margin:6px 0 0;font-size:14px;opacity:0.95;">You've been added as a Partner</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:15px;line-height:1.6;">Hi <strong>${name}</strong>,</p>
      <p style="font-size:14px;line-height:1.6;color:#3b4a35;">
        An admin has registered you as a partner on Agrocrest Farm Management. You now have access to track the livestock batches you've invested in — production, vaccinations, mortality, feed, and care logs.
      </p>
      <div style="margin:22px 0;padding:18px 20px;background:#f3f7ee;border:1px solid #d7e3c9;border-radius:10px;">
        <p style="margin:0 0 6px;font-size:12px;color:#5d6b50;text-transform:uppercase;letter-spacing:0.5px;">Your login details</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Email:</strong> ${email}</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Temporary password:</strong> <code style="background:#fff;padding:3px 8px;border-radius:5px;border:1px solid #d7e3c9;">${password}</code></p>
      </div>
      <p style="font-size:13px;color:#5d6b50;line-height:1.6;">
        For your security, please log in and reset your password right away using the "Forgot password" option on the sign-in page.
      </p>
      <div style="text-align:center;margin:26px 0 10px;">
        <a href="${appUrl}/auth" style="display:inline-block;background:#3f6f3a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Sign in to dashboard</a>
      </div>
      <p style="font-size:12px;color:#8a9580;margin-top:24px;text-align:center;">If you didn't expect this email, please ignore it.</p>
    </div>
    <div style="background:#1f2a1c;color:#c8d3bd;padding:14px;text-align:center;font-size:12px;">Agrocrest Farm Management</div>
  </div>
</body></html>`;

      await smtp.send({
        from: gmailUser,
        to: email,
        subject: "🌾 Welcome to Agrocrest — Your Partner Account",
        content: `Welcome ${name}. Email: ${email}  Temporary password: ${password}`,
        html,
      });
      await smtp.close();
    } catch (e) {
      console.error("Email send failed:", e);
      // continue — account is still created
    }

    return new Response(JSON.stringify({ success: true, partner: partnerRow, user_id: created.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
