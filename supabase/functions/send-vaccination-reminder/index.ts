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

    const body = await req.json().catch(() => ({}));
    const isTest = body.test === true;
    const branchId = body.branchId;
    const branchName = body.branchName || "All Branches";

    // Get active vaccination schedules
    let schedulesQuery = supabase
      .from("vaccination_schedules")
      .select(`
        *,
        vaccination_types(name, interval_weeks, description),
        livestock_categories(name)
      `)
      .eq("is_active", true);

    if (branchId) {
      schedulesQuery = schedulesQuery.eq("branch_id", branchId);
    }

    const { data: schedules } = await schedulesQuery;

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: "No active schedules" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate upcoming vaccinations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingVaccinations: any[] = [];

    for (const schedule of schedules) {
      const startDate = new Date(schedule.start_date);
      startDate.setHours(0, 0, 0, 0);
      const intervalWeeks = schedule.vaccination_types?.interval_weeks || 3;

      // Calculate next due date
      let nextDue = new Date(startDate);
      while (nextDue <= today) {
        nextDue = new Date(nextDue.getTime() + intervalWeeks * 7 * 24 * 60 * 60 * 1000);
      }

      const diffTime = nextDue.getTime() - today.getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Include if due tomorrow or overdue (for test, include all)
      if (isTest || daysUntil <= 1) {
        upcomingVaccinations.push({
          vaccineName: schedule.vaccination_types?.name || "Unknown",
          vaccineDescription: schedule.vaccination_types?.description || "",
          livestockCategory: schedule.livestock_categories?.name || "Unknown",
          dueDate: nextDue,
          daysUntil,
          isOverdue: daysUntil < 0,
          isDueTomorrow: daysUntil === 1,
          isDueToday: daysUntil === 0,
        });
      }
    }

    if (upcomingVaccinations.length === 0 && !isTest) {
      return new Response(JSON.stringify({ message: "No vaccinations due" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workers for notification (optionally filter by branch)
    let workersQuery = supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "worker");

    if (branchId) {
      workersQuery = workersQuery.eq("branch_id", branchId);
    }

    const { data: workers } = await workersQuery;

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

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const overdueItems = upcomingVaccinations.filter(v => v.isOverdue);
    const dueTodayItems = upcomingVaccinations.filter(v => v.isDueToday);
    const dueTomorrowItems = upcomingVaccinations.filter(v => v.isDueTomorrow);
    const upcomingItems = upcomingVaccinations.filter(v => v.daysUntil > 1);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">💉 Vaccination Reminder</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Agrocrest Farm - ${branchName}</p>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      ${isTest ? `
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
          <p style="margin: 0; font-size: 14px;">🧪 This is a TEST email</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Showing all scheduled vaccinations for testing purposes</p>
        </div>
      ` : ''}

      ${overdueItems.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
            ⚠️ OVERDUE Vaccinations
          </h2>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 15px;">
            ${overdueItems.map(v => `
              <div style="padding: 12px 0; ${overdueItems.indexOf(v) < overdueItems.length - 1 ? 'border-bottom: 1px solid #fecaca;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <p style="margin: 0; font-weight: bold; color: #dc2626; font-size: 16px;">${v.vaccineName}</p>
                    <p style="margin: 4px 0 0 0; color: #71717a; font-size: 14px;">${v.livestockCategory}</p>
                  </div>
                  <div style="text-align: right;">
                    <span style="background: #dc2626; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                      ${Math.abs(v.daysUntil)} days overdue
                    </span>
                    <p style="margin: 4px 0 0 0; color: #71717a; font-size: 12px;">Was due: ${formatDate(v.dueDate)}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${dueTodayItems.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #f59e0b; margin: 0 0 15px 0; font-size: 18px;">
            📅 Due TODAY
          </h2>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 15px;">
            ${dueTodayItems.map(v => `
              <div style="padding: 12px 0; ${dueTodayItems.indexOf(v) < dueTodayItems.length - 1 ? 'border-bottom: 1px solid #fde68a;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <p style="margin: 0; font-weight: bold; color: #b45309; font-size: 16px;">${v.vaccineName}</p>
                    <p style="margin: 4px 0 0 0; color: #71717a; font-size: 14px;">${v.livestockCategory}</p>
                  </div>
                  <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                    Today
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${dueTomorrowItems.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #2563eb; margin: 0 0 15px 0; font-size: 18px;">
            📆 Due TOMORROW
          </h2>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 15px;">
            ${dueTomorrowItems.map(v => `
              <div style="padding: 12px 0; ${dueTomorrowItems.indexOf(v) < dueTomorrowItems.length - 1 ? 'border-bottom: 1px solid #bfdbfe;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <p style="margin: 0; font-weight: bold; color: #1d4ed8; font-size: 16px;">${v.vaccineName}</p>
                    <p style="margin: 4px 0 0 0; color: #71717a; font-size: 14px;">${v.livestockCategory}</p>
                  </div>
                  <div style="text-align: right;">
                    <span style="background: #2563eb; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                      Tomorrow
                    </span>
                    <p style="margin: 4px 0 0 0; color: #71717a; font-size: 12px;">${formatDate(v.dueDate)}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${isTest && upcomingItems.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #16a34a; margin: 0 0 15px 0; font-size: 18px;">
            ✅ Upcoming (For Reference)
          </h2>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 15px;">
            ${upcomingItems.slice(0, 5).map(v => `
              <div style="padding: 12px 0; ${upcomingItems.indexOf(v) < Math.min(upcomingItems.length, 5) - 1 ? 'border-bottom: 1px solid #bbf7d0;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <p style="margin: 0; font-weight: bold; color: #15803d; font-size: 16px;">${v.vaccineName}</p>
                    <p style="margin: 4px 0 0 0; color: #71717a; font-size: 14px;">${v.livestockCategory}</p>
                  </div>
                  <div style="text-align: right;">
                    <span style="background: #16a34a; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                      In ${v.daysUntil} days
                    </span>
                    <p style="margin: 4px 0 0 0; color: #71717a; font-size: 12px;">${formatDate(v.dueDate)}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); border-radius: 12px; padding: 20px; margin-top: 25px; text-align: center;">
        <p style="margin: 0; color: #7c3aed; font-size: 14px;">
          💡 <strong>Reminder:</strong> Ensure all vaccination records are logged after administration!
        </p>
      </div>

      <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e4e4e7;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          This is an automated reminder from Agrocrest Farm Management System
        </p>
        <p style="color: #a1a1aa; font-size: 11px; margin: 5px 0 0 0;">
          ${new Date().toLocaleString()}
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

    const subject = isTest 
      ? `🧪 TEST: Vaccination Reminder - ${branchName}`
      : `💉 Vaccination Reminder - Action Required - ${branchName}`;

    await client.send({
      from: smtpFrom || smtpUser,
      to: workerEmails,
      subject,
      html: htmlContent,
    });

    await client.close();

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Reminder sent to ${workerEmails.length} workers`,
      vaccinations: upcomingVaccinations.length,
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
