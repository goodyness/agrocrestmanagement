import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      ageWeeks,
      birds,
      recentRows = [],
      avgLayRate,
      last7Avg,
      prev7Avg,
      question,
    } = body ?? {};

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const history = (recentRows as any[])
      .slice(0, 21)
      .map((r) => `${r.date}: ${r.total_eggs} eggs (${r.lay_rate}% lay rate)`)
      .join("; ");

    const prompt = `You are an expert Nigerian poultry (layer) production advisor.

Batch context:
- Birds currently in batch: ${birds}
- Flock age: ${ageWeeks} weeks
- Average lay rate so far: ${avgLayRate}%
- Last 7-day average eggs/day: ${last7Avg}
- Previous 7-day average eggs/day: ${prev7Avg}
- Recent daily records: ${history || "none yet"}
${question ? `\nThe farmer asks: "${question}"` : ""}

Analyse the production trend against typical layer performance curves (peak lay ~90% at 26-32 weeks, gradual decline after). Identify whether production is normal, rising, or declining abnormally, likely causes (feed quality/quantity, water, lighting hours, heat stress, disease, parasites, molting, age) and practical Nigerian-context actions.

Respond ONLY in JSON:
{
  "status": "healthy|watch|critical",
  "summary": "2-3 sentence assessment of the trend",
  "expected_lay_rate": "expected % for this age",
  "causes": ["likely cause 1", "likely cause 2"],
  "actions": [{"title": "string", "detail": "string", "urgency": "critical|recommended|optional"}],
  "tip": "one practical tip"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached, please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI gateway error: ${t}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content, actions: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
