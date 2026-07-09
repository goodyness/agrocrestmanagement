import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Notify no more often than once every 24 hours per batch
const NOTIFY_COOLDOWN_HOURS = 24;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
    const adminReceiver = Deno.env.get("GMAIL_RECEIVER") || gmailUser;
    let smtp: SMTPClient | null = null;
    if (gmailUser && gmailPass) {
      smtp = new SMTPClient({
        connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Pending batches whose expected_arrival_date is past today
    const { data: overdue, error } = await supabase
      .from("livestock_batches")
      .select("id, species, species_type, expected_arrival_date, expected_source, expected_cost_per_unit, quantity, branch_id, last_overdue_notified_at, availability_status")
      .eq("availability_status", "pending")
      .lt("expected_arrival_date", today);

    if (error) throw error;

    const results: any[] = [];
    for (const b of overdue || []) {
      if (b.last_overdue_notified_at) {
        const hrs = (Date.now() - new Date(b.last_overdue_notified_at).getTime()) / 36e5;
        if (hrs < NOTIFY_COOLDOWN_HOURS) { results.push({ id: b.id, skipped: true }); continue; }
      }

      // Collect recipients: admin + linked partners
      const recipients: { email: string; name?: string }[] = [];
      if (adminReceiver) recipients.push({ email: adminReceiver, name: "Admin" });

      const { data: links } = await supabase
        .from("partner_batches")
        .select("partners!inner(profile_id, profiles!partners_profile_id_fkey(name, email))")
        .eq("batch_id", b.id);
      for (const l of links || []) {
        const p: any = (l as any).partners?.profiles;
        if (p?.email) recipients.push({ email: p.email, name: p.name });
      }

      const daysLate = Math.max(1, Math.floor((Date.now() - new Date(b.expected_arrival_date!).getTime()) / 864e5));
      const subject = `⏰ Batch overdue: ${b.species_type || b.species} stock has not arrived (${daysLate}d late)`;
      const html = `<div style="font-family:Arial,sans-serif;padding:16px;color:#1f2a1c;">
        <h2 style="margin:0 0 8px;color:#b45309;">Batch stock is overdue</h2>
        <p>Expected arrival <b>${new Date(b.expected_arrival_date!).toLocaleDateString()}</b> — <b>${daysLate} day(s) late</b>.</p>
        <ul>
          <li>Species: <b>${b.species_type || b.species}</b></li>
          <li>Expected qty: <b>${b.quantity}</b></li>
          <li>Expected source: <b>${b.expected_source || "—"}</b></li>
          <li>Expected cost/unit: <b>${b.expected_cost_per_unit ? "₦" + Number(b.expected_cost_per_unit).toLocaleString() : "—"}</b></li>
        </ul>
        <p>Please confirm availability from the batch page as soon as the stock arrives, or update the expected date.</p>
      </div>`;

      if (smtp && recipients.length) {
        for (const r of recipients) {
          try {
            await smtp.send({ from: gmailUser!, to: r.email, subject, content: `Batch overdue: expected ${b.expected_arrival_date}. ${daysLate} days late.`, html });
          } catch (e) { console.error("mail send failed", r.email, e); }
        }
      }

      await supabase.from("livestock_batches").update({ last_overdue_notified_at: new Date().toISOString() }).eq("id", b.id);
      await supabase.from("batch_availability_events").insert({
        batch_id: b.id,
        event_type: "overdue_notified",
        from_status: "pending",
        to_status: "pending",
        notes: `Overdue by ${daysLate} day(s); notified ${recipients.length} recipient(s)`,
        metadata: { days_late: daysLate, recipients: recipients.map(r => r.email) },
      });
      results.push({ id: b.id, notified: recipients.length, days_late: daysLate });
    }

    if (smtp) { try { await smtp.close(); } catch { /* ignore */ } }
    return new Response(JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
