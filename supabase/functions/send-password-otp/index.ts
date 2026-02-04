import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if email exists in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", email)
      .single();

    if (!profile) {
      // Don't reveal if email exists for security
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, an OTP has been sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error saving OTP:", insertError);
      throw new Error("Failed to generate OTP");
    }

    // Send email
    const gmailUser = Deno.env.get("GMAIL_USER")!;
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD")!;

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
    <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <div style="width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px;">🔐</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
        Password Reset
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
        Agrocrest Farm Management System
      </p>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
        You requested to reset your password. Use the code below to verify your identity:
      </p>

      <!-- OTP Code Box -->
      <div style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #166534; font-size: 14px; font-weight: 600;">Your OTP Code</p>
        <p style="margin: 0; font-size: 36px; font-weight: 700; color: #15803d; letter-spacing: 8px; font-family: monospace;">
          ${otpCode}
        </p>
      </div>

      <!-- Warning Box -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #92400e; font-weight: 600;">
          ⏰ This code expires in 10 minutes
        </p>
        <p style="margin: 8px 0 0; color: #78350f; font-size: 14px;">
          If you didn't request this, please ignore this email or contact support.
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

    console.log("Sending OTP email to:", email);

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
      to: email,
      subject: "🔐 Password Reset OTP - Agrocrest Farm",
      content: "Your OTP code for password reset.",
      html: htmlEmail,
    });

    await client.close();

    console.log("OTP email sent successfully!");

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
