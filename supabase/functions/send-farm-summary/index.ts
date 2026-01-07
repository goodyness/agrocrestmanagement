import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const gmailUser = Deno.env.get("GMAIL_USER")!;
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD")!;
    const receiverEmail = Deno.env.get("GMAIL_RECEIVER")!;

    console.log("Starting email summary generation...");

    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const dateRangeStart = threeDaysAgo.toISOString().split('T')[0];
    const dateRangeEnd = today.toISOString().split('T')[0];

    // Fetch sales data
    const { data: sales } = await supabase
      .from("sales_records")
      .select("*")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalSales = sales?.reduce((acc: number, s: any) => acc + Number(s.total_amount), 0) || 0;
    const salesCount = sales?.length || 0;

    // Fetch production data
    const { data: production } = await supabase
      .from("daily_production")
      .select("*")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalCrates = production?.reduce((acc: number, p: any) => acc + p.crates, 0) || 0;
    const totalPieces = production?.reduce((acc: number, p: any) => acc + p.pieces, 0) || 0;

    // Fetch mortality data
    const { data: mortality } = await supabase
      .from("mortality_records")
      .select("*, livestock_categories(name)")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalMortality = mortality?.reduce((acc: number, m: any) => acc + m.quantity_dead, 0) || 0;

    // Fetch expenses
    const { data: expenses } = await supabase
      .from("miscellaneous_expenses")
      .select("*")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalExpenses = expenses?.reduce((acc: number, e: any) => acc + Number(e.amount), 0) || 0;

    // Fetch feed consumption
    const { data: feedConsumption } = await supabase
      .from("feed_consumption")
      .select("*, feed_types(feed_name, price_per_unit)")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalFeedCost = feedConsumption?.reduce((acc: number, f: any) => {
      return acc + (f.quantity_used * (f.feed_types?.price_per_unit || 0));
    }, 0) || 0;

    // Get current livestock count
    const { data: census } = await supabase
      .from("livestock_census")
      .select("updated_count, livestock_categories(name)");

    const totalLivestock = census?.reduce((acc: number, c: any) => acc + c.updated_count, 0) || 0;

    // Get feed inventory status
    const { data: feedInventory } = await supabase
      .from("feed_inventory")
      .select("*, feed_types(feed_name)");

    const profit = totalSales - totalExpenses - totalFeedCost;

    // Build mortality details
    const mortalityRows = mortality?.map((m: any) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${m.livestock_categories?.name || 'Unknown'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #dc2626; font-weight: 600;">${m.quantity_dead}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${m.reason || 'Not specified'}</td>
      </tr>
    `).join("") || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #22c55e;">✓ No mortality recorded</td></tr>';

    // Build livestock census
    const censusRows = census?.map((c: any) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${c.livestock_categories?.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${c.updated_count.toLocaleString()}</td>
      </tr>
    `).join("") || "";

    // Build feed inventory status
    const feedRows = feedInventory?.map((f: any) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${f.feed_types?.feed_name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          <span style="background-color: ${Number(f.quantity_in_stock) < 50 ? '#fef2f2' : '#f0fdf4'}; color: ${Number(f.quantity_in_stock) < 50 ? '#dc2626' : '#16a34a'}; padding: 4px 12px; border-radius: 20px; font-weight: 600;">
            ${f.quantity_in_stock} ${f.unit}
          </span>
        </td>
      </tr>
    `).join("") || "";

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 650px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <div style="width: 72px; height: 72px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 36px;">🌾</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700;">
        Agrocrest Farm Report
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
        3-Day Summary: ${dateRangeStart} to ${dateRangeEnd}
      </p>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 32px;">
      
      <!-- Quick Stats -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px;">
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; color: #92400e; font-size: 12px; text-transform: uppercase; font-weight: 600;">Total Sales</p>
          <p style="margin: 8px 0 0; color: #78350f; font-size: 24px; font-weight: 700;">₦${totalSales.toLocaleString()}</p>
        </div>
        <div style="background: linear-gradient(135deg, ${profit >= 0 ? '#d1fae5' : '#fee2e2'} 0%, ${profit >= 0 ? '#a7f3d0' : '#fecaca'} 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; color: ${profit >= 0 ? '#047857' : '#b91c1c'}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Net ${profit >= 0 ? 'Profit' : 'Loss'}</p>
          <p style="margin: 8px 0 0; color: ${profit >= 0 ? '#065f46' : '#991b1b'}; font-size: 24px; font-weight: 700;">₦${Math.abs(profit).toLocaleString()}</p>
        </div>
      </div>

      <!-- Production Section -->
      <div style="margin-bottom: 28px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          🥚 Production Summary
        </h2>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Production</p>
              <p style="margin: 4px 0 0; color: #1f2937; font-size: 20px; font-weight: 700;">${totalCrates} crates, ${totalPieces} pieces</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Production Days</p>
              <p style="margin: 4px 0 0; color: #1f2937; font-size: 20px; font-weight: 700;">${production?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Sales Section -->
      <div style="margin-bottom: 28px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          💰 Sales Summary
        </h2>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">Total Sales Amount</td>
              <td style="text-align: right; font-weight: 600; color: #059669;">₦${totalSales.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">Number of Transactions</td>
              <td style="text-align: right; font-weight: 600;">${salesCount}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">Average per Sale</td>
              <td style="text-align: right; font-weight: 600;">₦${salesCount > 0 ? Math.round(totalSales / salesCount).toLocaleString() : 0}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Expenses Section -->
      <div style="margin-bottom: 28px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          💸 Expenses Breakdown
        </h2>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">Miscellaneous Expenses</td>
              <td style="text-align: right; font-weight: 600; color: #dc2626;">₦${totalExpenses.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">Feed Costs</td>
              <td style="text-align: right; font-weight: 600; color: #dc2626;">₦${totalFeedCost.toLocaleString()}</td>
            </tr>
            <tr style="border-top: 2px solid #e5e7eb;">
              <td style="color: #374151; padding: 8px 0 4px; font-weight: 600;">Total Expenses</td>
              <td style="text-align: right; font-weight: 700; color: #b91c1c; padding: 8px 0 4px;">₦${(totalExpenses + totalFeedCost).toLocaleString()}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Livestock Section -->
      <div style="margin-bottom: 28px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          🐔 Livestock Status
        </h2>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px;">
          <p style="margin: 0 0 12px; color: #374151; font-weight: 600;">Total Count: ${totalLivestock.toLocaleString()} birds</p>
          <table style="width: 100%; border-collapse: collapse;">
            ${censusRows}
          </table>
        </div>
      </div>

      <!-- Mortality Section -->
      <div style="margin-bottom: 28px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          ⚠️ Mortality Report ${totalMortality > 0 ? `<span style="background-color: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 14px; margin-left: 8px;">${totalMortality} deaths</span>` : ''}
        </h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr style="background-color: #e5e7eb;">
              <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #374151;">Category</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #374151;">Count</th>
              <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #374151;">Reason</th>
            </tr>
          </thead>
          <tbody>
            ${mortalityRows}
          </tbody>
        </table>
      </div>

      <!-- Feed Inventory Section -->
      <div style="margin-bottom: 28px;">
        <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          📦 Feed Inventory Status
        </h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr style="background-color: #e5e7eb;">
              <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #374151;">Feed Type</th>
              <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">Stock Level</th>
            </tr>
          </thead>
          <tbody>
            ${feedRows || '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #6b7280;">No feed inventory data</td></tr>'}
          </tbody>
        </table>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #1f2937; border-radius: 0 0 16px 16px; padding: 24px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        This is an automated report from Agrocrest Farm Management System
      </p>
      <p style="color: #6b7280; font-size: 11px; margin: 8px 0 0;">
        Generated on ${new Date().toLocaleString()}
      </p>
    </div>
  </div>
</body>
</html>
    `;

    console.log("Sending email via Gmail SMTP...");

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });

    await client.send({
      from: gmailUser,
      to: receiverEmail,
      subject: `🌾 Agrocrest Farm Summary Report - ${dateRangeStart} to ${dateRangeEnd}`,
      content: "Please view this email in HTML format.",
      html: htmlEmail,
    });

    await client.close();

    console.log("Email sent successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Summary email sent successfully",
        summary: {
          period: { start: dateRangeStart, end: dateRangeEnd },
          sales: totalSales,
          production: { crates: totalCrates, pieces: totalPieces },
          mortality: totalMortality,
          expenses: totalExpenses + totalFeedCost,
          profit,
          livestock: totalLivestock,
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending summary email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
