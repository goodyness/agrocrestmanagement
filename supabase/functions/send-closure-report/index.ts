import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batchLabel, summaryHtml, recipients, pdfBase64, fileName } = await req.json();

    if (!pdfBase64 || !Array.isArray(recipients)) {
      return new Response(JSON.stringify({ error: "pdfBase64 and recipients are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gmailUser = Deno.env.get("GMAIL_USER")!;
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD")!;
    const fallback = Deno.env.get("GMAIL_RECEIVER");

    const to = Array.from(
      new Set([...recipients, fallback].filter((e: unknown): e is string => typeof e === "string" && e.includes("@"))),
    );
    if (to.length === 0) {
      return new Response(JSON.stringify({ error: "No valid recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailPassword },
      },
    });

    const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));

    await client.send({
      from: `Agrocrest Farm <${gmailUser}>`,
      to,
      subject: `Production cycle closed - ${batchLabel}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
          <div style="background:#226e3c;color:#fff;padding:18px 22px">
            <h2 style="margin:0">Agrocrest Farm</h2>
            <p style="margin:4px 0 0;font-size:14px">Production cycle closure report</p>
          </div>
          <div style="padding:22px;color:#111">
            <p><b>${batchLabel}</b> has been closed and the final report is attached as a PDF.</p>
            ${summaryHtml || ""}
            <p style="font-size:12px;color:#666;margin-top:20px">This report was generated automatically and can no longer be edited.</p>
          </div>
        </div>`,
      attachments: [
        {
          filename: fileName || "closure-report.pdf",
          content: bytes,
          encoding: "binary",
          contentType: "application/pdf",
        },
      ],
    });

    await client.close();

    return new Response(JSON.stringify({ success: true, sentTo: to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-closure-report failed:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
