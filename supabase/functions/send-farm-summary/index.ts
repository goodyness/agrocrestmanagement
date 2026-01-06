import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    const totalSales = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
    const salesCount = sales?.length || 0;

    // Fetch production data
    const { data: production } = await supabase
      .from("daily_production")
      .select("*")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalCrates = production?.reduce((acc, p) => acc + p.crates, 0) || 0;
    const totalPieces = production?.reduce((acc, p) => acc + p.pieces, 0) || 0;

    // Fetch mortality data
    const { data: mortality } = await supabase
      .from("mortality_records")
      .select("*, livestock_categories(name)")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalMortality = mortality?.reduce((acc, m) => acc + m.quantity_dead, 0) || 0;

    // Fetch expenses
    const { data: expenses } = await supabase
      .from("miscellaneous_expenses")
      .select("*")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalExpenses = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;

    // Fetch feed consumption
    const { data: feedConsumption } = await supabase
      .from("feed_consumption")
      .select("*, feed_types(feed_name, price_per_unit)")
      .gte("date", dateRangeStart)
      .lte("date", dateRangeEnd);

    const totalFeedCost = feedConsumption?.reduce((acc, f) => {
      return acc + (f.quantity_used * (f.feed_types?.price_per_unit || 0));
    }, 0) || 0;

    // Get current livestock count
    const { data: census } = await supabase
      .from("livestock_census")
      .select("updated_count, livestock_categories(name)");

    const totalLivestock = census?.reduce((acc, c) => acc + c.updated_count, 0) || 0;

    // Build email content
    const profit = totalSales - totalExpenses - totalFeedCost;
    const mortalityDetails = mortality?.map(m => 
      `  • ${m.livestock_categories?.name}: ${m.quantity_dead} (${m.reason || 'No reason specified'})`
    ).join('\n') || '  No mortality recorded';

    const emailBody = `
===============================================
   AGROCREST FARM - 3-DAY SUMMARY REPORT
===============================================
Period: ${dateRangeStart} to ${dateRangeEnd}

📊 PRODUCTION SUMMARY
─────────────────────────────────────────────
Total Egg Production: ${totalCrates} crates, ${totalPieces} pieces
Production Days: ${production?.length || 0}

💰 SALES SUMMARY
─────────────────────────────────────────────
Total Sales: ₦${totalSales.toLocaleString()}
Number of Transactions: ${salesCount}
Average per Sale: ₦${salesCount > 0 ? Math.round(totalSales / salesCount).toLocaleString() : 0}

💸 EXPENSES SUMMARY
─────────────────────────────────────────────
Miscellaneous Expenses: ₦${totalExpenses.toLocaleString()}
Feed Costs: ₦${totalFeedCost.toLocaleString()}
Total Expenses: ₦${(totalExpenses + totalFeedCost).toLocaleString()}

📈 PROFIT/LOSS
─────────────────────────────────────────────
Net ${profit >= 0 ? 'Profit' : 'Loss'}: ₦${Math.abs(profit).toLocaleString()}

🐔 LIVESTOCK STATUS
─────────────────────────────────────────────
Current Total Count: ${totalLivestock.toLocaleString()} birds
${census?.map((c: any) => `  • ${c.livestock_categories?.name}: ${c.updated_count.toLocaleString()}`).join('\n') || ''}

⚠️ MORTALITY REPORT
─────────────────────────────────────────────
Total Deaths: ${totalMortality}
${mortalityDetails}

===============================================
This report was automatically generated.
Date Generated: ${new Date().toLocaleString()}
===============================================
    `.trim();

    // Send email using Gmail SMTP via fetch to smtp2go or similar service
    // For Gmail SMTP, we'll use a different approach with nodemailer-like syntax
    const smtpEndpoint = "https://api.smtp2go.com/v3/email/send";
    
    // Since Gmail SMTP requires nodemailer which isn't available in Deno,
    // we'll use the simpler approach of encoding and sending via HTTPS
    const emailData = {
      sender: gmailUser,
      to: [receiverEmail],
      subject: `Agrocrest Farm Summary Report - ${dateRangeStart} to ${dateRangeEnd}`,
      text_body: emailBody,
    };

    // Using Gmail via built-in Deno SMTP
    const encoder = new TextEncoder();
    const credentials = btoa(`${gmailUser}:${gmailPassword}`);
    
    // Connect to Gmail SMTP
    const conn = await Deno.connectTls({
      hostname: "smtp.gmail.com",
      port: 465,
    });

    const write = async (text: string) => {
      await conn.write(encoder.encode(text + "\r\n"));
      const buffer = new Uint8Array(1024);
      await conn.read(buffer);
      return new TextDecoder().decode(buffer);
    };

    await conn.read(new Uint8Array(1024)); // Read greeting
    await write(`EHLO localhost`);
    await write(`AUTH LOGIN`);
    await write(btoa(gmailUser));
    await write(btoa(gmailPassword));
    await write(`MAIL FROM:<${gmailUser}>`);
    await write(`RCPT TO:<${receiverEmail}>`);
    await write(`DATA`);
    
    const message = `From: ${gmailUser}\r\nTo: ${receiverEmail}\r\nSubject: Agrocrest Farm Summary Report - ${dateRangeStart} to ${dateRangeEnd}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${emailBody}`;
    await write(message);
    await write(`.`);
    await write(`QUIT`);
    
    conn.close();

    console.log("Email sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Summary email sent",
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
