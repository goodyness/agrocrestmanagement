import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "https://esm.sh/nodemailer@6.9.10";

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

    console.log("Checking for low stock items...");

    const body = await req.json().catch(() => ({}));
    const isTest = body.test === true;

    // Get active alerts with feed type info
    const { data: alerts } = await supabase
      .from("low_stock_alerts")
      .select("*, feed_types(feed_name)")
      .eq("is_active", true);

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active alerts configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get current inventory
    const { data: inventory } = await supabase
      .from("feed_inventory")
      .select("*, feed_types(feed_name)");

    const lowStockItems: any[] = [];

    for (const alert of alerts) {
      const inv = inventory?.find((i: any) => i.feed_type_id === alert.feed_type_id);
      const currentStock = inv?.quantity_in_stock || 0;
      
      if (currentStock <= alert.threshold_quantity || isTest) {
        lowStockItems.push({
          feedName: alert.feed_types?.feed_name || "Unknown Feed",
          currentStock: currentStock,
          threshold: alert.threshold_quantity,
          unit: alert.threshold_unit,
        });
      }
    }

    if (lowStockItems.length === 0 && !isTest) {
      console.log("No low stock items found");
      return new Response(
        JSON.stringify({ message: "All stock levels are adequate" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build styled HTML email
    const stockRows = (isTest ? [{ feedName: "Test Feed", currentStock: 10, threshold: 50, unit: "kg" }] : lowStockItems)
      .map(item => `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${item.feedName}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="background-color: #fef2f2; color: #dc2626; padding: 4px 12px; border-radius: 20px; font-weight: 600;">
              ${item.currentStock} ${item.unit}
            </span>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
            ${item.threshold} ${item.unit}
          </td>
        </tr>
      `).join("");

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <div style="width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px;">⚠️</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
        ${isTest ? "🔔 Test Alert" : "⚠️ Low Stock Alert"}
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
        Agrocrest Farm Inventory System
      </p>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
        ${isTest 
          ? "This is a test alert to confirm your low stock notification system is working correctly."
          : "The following feed items are running low and require immediate attention:"
        }
      </p>

      <!-- Stock Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Feed Type</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Current Stock</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Threshold</th>
          </tr>
        </thead>
        <tbody>
          ${stockRows}
        </tbody>
      </table>

      <!-- Action Box -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #92400e; font-weight: 600;">
          📋 Recommended Action
        </p>
        <p style="margin: 8px 0 0; color: #78350f; font-size: 14px;">
          Please restock these items as soon as possible to avoid disruption to farm operations.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This is an automated notification from Agrocrest Farm Management System
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
          Generated on ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    console.log("Sending low stock alert email...");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    await transporter.sendMail({
      from: `"Agrocrest Farm Alerts" <${gmailUser}>`,
      to: receiverEmail,
      subject: isTest 
        ? "🔔 Test Low Stock Alert - Agrocrest Farm" 
        : `⚠️ Low Stock Alert - ${lowStockItems.length} item(s) need restocking`,
      html: htmlEmail,
    });

    // Update last_alert_sent for triggered alerts
    if (!isTest) {
      for (const item of lowStockItems) {
        const alert = alerts.find((a: any) => a.feed_types?.feed_name === item.feedName);
        if (alert) {
          await supabase
            .from("low_stock_alerts")
            .update({ last_alert_sent: new Date().toISOString() })
            .eq("id", alert.id);
        }
      }
    }

    console.log("Low stock alert email sent successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Alert sent for ${lowStockItems.length} low stock item(s)`,
        items: lowStockItems,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending low stock alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
