import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active cleaning schedule
    const { data: schedule } = await supabase
      .from("cleaning_schedules")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!schedule) {
      return new Response(JSON.stringify({ message: "No active schedule" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate next cleaning date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(schedule.start_date);
    startDate.setHours(0, 0, 0, 0);
    
    let nextCleaningDate: Date;
    if (startDate >= today) {
      nextCleaningDate = startDate;
    } else {
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const cyclesPassed = Math.floor(daysSinceStart / schedule.interval_days);
      const nextCycle = (cyclesPassed + 1) * schedule.interval_days;
      
      nextCleaningDate = new Date(startDate);
      nextCleaningDate.setDate(nextCleaningDate.getDate() + nextCycle);
      
      if (daysSinceStart % schedule.interval_days === 0) {
        nextCleaningDate = today;
      }
    }

    const diffTime = nextCleaningDate.getTime() - today.getTime();
    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Only send reminder if tomorrow is cleaning day
    if (daysUntil !== 1) {
      return new Response(JSON.stringify({ message: "Not reminder day" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get worker emails
    const { data: workers } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "worker");

    if (!workers || workers.length === 0) {
      return new Response(JSON.stringify({ message: "No workers found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get worker emails from auth
    const workerEmails: string[] = [];
    for (const worker of workers) {
      const { data: authUser } = await supabase.auth.admin.getUserById(worker.id);
      if (authUser?.user?.email) {
        workerEmails.push(authUser.user.email);
      }
    }

    if (workerEmails.length === 0) {
      return new Response(JSON.stringify({ message: "No worker emails found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tasks = schedule.tasks || [];
    const cleaningDate = nextCleaningDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🧹 Cleaning Reminder</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Agrocrest Farm</p>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 15px 25px; border-radius: 12px; display: inline-block;">
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">SCHEDULED FOR TOMORROW</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${cleaningDate}</p>
        </div>
      </div>

      <h2 style="color: #18181b; margin: 0 0 20px 0; font-size: 20px;">📋 Tasks to Complete</h2>
      
      <div style="background: #f4f4f5; border-radius: 12px; padding: 20px;">
        ${tasks.map((task: string, index: number) => `
          <div style="display: flex; align-items: center; padding: 12px 0; ${index < tasks.length - 1 ? 'border-bottom: 1px solid #e4e4e7;' : ''}">
            <span style="background: #16a34a; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px;">${index + 1}</span>
            <span style="color: #18181b; font-size: 16px;">${task}</span>
          </div>
        `).join('')}
      </div>

      <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 12px; padding: 20px; margin-top: 25px; text-align: center;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
          💡 <strong>Tip:</strong> Start early in the morning for best results!
        </p>
      </div>

      <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e4e4e7;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          This is an automated reminder from Agrocrest Farm Management System
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Send email
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: 465,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    await client.send({
      from: smtpFrom || smtpUser,
      to: workerEmails,
      subject: `🧹 Cleaning Reminder - Tomorrow ${cleaningDate}`,
      html: htmlContent,
    });

    await client.close();

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Reminder sent to ${workerEmails.length} workers` 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
