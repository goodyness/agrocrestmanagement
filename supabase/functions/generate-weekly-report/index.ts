import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
    const gmailReceiver = Deno.env.get("GMAIL_RECEIVER");

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    // Fetch weekly data
    const [prodRes, salesRes, expensesRes, feedRes, mortRes, batchRes] = await Promise.all([
      supabase.from("daily_production").select("date, crates, pieces").gte("date", startDate).lte("date", endDate).order("date"),
      supabase.from("sales_records").select("date, product_name, product_type, quantity, total_amount, amount_paid, payment_status").gte("date", startDate).lte("date", endDate),
      supabase.from("miscellaneous_expenses").select("date, expense_type, amount, description").gte("date", startDate).lte("date", endDate),
      supabase.from("feed_purchases").select("date, total_cost, quantity").gte("date", startDate).lte("date", endDate),
      supabase.from("mortality_records").select("date, quantity_dead, reason").gte("date", startDate).lte("date", endDate),
      supabase.from("livestock_batches").select("species, species_type, current_quantity, age_weeks, stage, is_active").eq("is_active", true),
    ]);

    const production = prodRes.data || [];
    const sales = salesRes.data || [];
    const expenses = expensesRes.data || [];
    const feedPurchases = feedRes.data || [];
    const mortality = mortRes.data || [];
    const batches = batchRes.data || [];

    // Calculate summaries
    const totalCrates = production.reduce((s, p) => s + p.crates, 0);
    const totalPieces = production.reduce((s, p) => s + p.pieces, 0);
    const totalRevenue = sales.reduce((s, r) => s + Number(r.total_amount), 0);
    const totalPaid = sales.reduce((s, r) => s + Number(r.amount_paid), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalFeedCost = feedPurchases.reduce((s, f) => s + Number(f.total_cost), 0);
    const totalMortality = mortality.reduce((s, m) => s + m.quantity_dead, 0);
    const totalBirds = batches.reduce((s, b) => s + b.current_quantity, 0);
    const netProfit = totalRevenue - totalExpenses - totalFeedCost;

    // Revenue by product type
    const revenueByType: Record<string, number> = {};
    sales.forEach(s => {
      revenueByType[s.product_type] = (revenueByType[s.product_type] || 0) + Number(s.total_amount);
    });

    // Expense breakdown
    const expenseByType: Record<string, number> = {};
    expenses.forEach(e => {
      expenseByType[e.expense_type] = (expenseByType[e.expense_type] || 0) + Number(e.amount);
    });

    // Build HTML report
    const html = `
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0;">🌾 Agrocrest Farm - Weekly Report</h1>
        <p style="color: #e5e5e5; margin: 5px 0 0 0;">${startDate} to ${endDate}</p>
      </div>

      <h2 style="border-bottom: 2px solid #16a34a; padding-bottom: 5px;">📊 Performance Summary</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f0fdf4;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Production</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${totalCrates} crates + ${totalPieces} pieces</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Revenue</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; color: #16a34a; font-weight: bold;">₦${totalRevenue.toLocaleString()}</td>
        </tr>
        <tr style="background: #f0fdf4;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Expenses</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; color: #dc2626;">₦${(totalExpenses + totalFeedCost).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Net Profit</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; color: ${netProfit >= 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">₦${netProfit.toLocaleString()}</td>
        </tr>
        <tr style="background: #f0fdf4;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Mortality</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${totalMortality} birds</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Outstanding Payments</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; color: #f59e0b;">₦${(totalRevenue - totalPaid).toLocaleString()}</td>
        </tr>
      </table>

      <h2 style="border-bottom: 2px solid #16a34a; padding-bottom: 5px;">💰 Revenue Breakdown</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #16a34a; color: white;">
          <th style="padding: 8px; text-align: left;">Product</th>
          <th style="padding: 8px; text-align: right;">Amount</th>
        </tr>
        ${Object.entries(revenueByType).map(([type, amount]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${type}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₦${(amount as number).toLocaleString()}</td>
        </tr>`).join("")}
      </table>

      <h2 style="border-bottom: 2px solid #16a34a; padding-bottom: 5px;">📋 Expense Breakdown</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #dc2626; color: white;">
          <th style="padding: 8px; text-align: left;">Category</th>
          <th style="padding: 8px; text-align: right;">Amount</th>
        </tr>
        ${Object.entries(expenseByType).map(([type, amount]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${type}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₦${(amount as number).toLocaleString()}</td>
        </tr>`).join("")}
        ${totalFeedCost > 0 ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Feed Purchases</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₦${totalFeedCost.toLocaleString()}</td>
        </tr>` : ""}
      </table>

      <h2 style="border-bottom: 2px solid #16a34a; padding-bottom: 5px;">🐔 Livestock Status</h2>
      <p>Total active birds: <strong>${totalBirds.toLocaleString()}</strong></p>
      <ul>
        ${batches.map(b => `<li>${b.species} ${b.species_type || ""} — ${b.current_quantity} birds, ${b.age_weeks} weeks, ${b.stage || "N/A"}</li>`).join("")}
      </ul>

      <div style="margin-top: 30px; padding: 15px; background: #f0fdf4; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #666;">This is an automated weekly report from Agrocrest Farm Management System</p>
      </div>
    </body>
    </html>`;

    // Send via Gmail SMTP
    if (gmailUser && gmailPass && gmailReceiver) {
      const smtpPayload = {
        from: gmailUser,
        to: gmailReceiver,
        subject: `Agrocrest Weekly Report: ${startDate} to ${endDate}`,
        html,
      };

      // Use a simple SMTP approach via Deno
      const emailEndpoint = `https://api.smtp2go.com/v3/email/send`;
      // Since we use Gmail SMTP, we'll construct the email manually
      const boundary = "----=_Part_" + Math.random().toString(36).slice(2);
      const emailBody = [
        `From: Agrocrest Farm <${gmailUser}>`,
        `To: ${gmailReceiver}`,
        `Subject: Agrocrest Weekly Report: ${startDate} to ${endDate}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        html,
      ].join("\r\n");

      // Use Deno's built-in SMTP (via raw TCP)
      try {
        const conn = await Deno.connectTls({ hostname: "smtp.gmail.com", port: 465 });
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const read = async () => {
          const buf = new Uint8Array(4096);
          const n = await conn.read(buf);
          return n ? decoder.decode(buf.subarray(0, n)) : "";
        };

        const write = async (cmd: string) => {
          await conn.write(encoder.encode(cmd + "\r\n"));
          return await read();
        };

        await read(); // greeting
        await write("EHLO localhost");
        await write(`AUTH LOGIN`);
        await write(btoa(gmailUser));
        await write(btoa(gmailPass));
        await write(`MAIL FROM:<${gmailUser}>`);
        await write(`RCPT TO:<${gmailReceiver}>`);
        await write("DATA");
        await conn.write(encoder.encode(emailBody + "\r\n.\r\n"));
        await read();
        await write("QUIT");
        conn.close();
      } catch (emailErr) {
        console.error("SMTP error:", emailErr);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      summary: {
        period: `${startDate} to ${endDate}`,
        totalCrates, totalRevenue, totalExpenses: totalExpenses + totalFeedCost, netProfit, totalMortality,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
