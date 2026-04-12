import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { branch_id, days = 14 } = await req.json().catch(() => ({}));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0];

    // Fetch historical data
    let prodQ = supabase.from("daily_production").select("date, crates, pieces").gte("date", sixtyDaysAgo).order("date");
    let batchQ = supabase.from("livestock_batches").select("species, species_type, current_quantity, age_weeks, has_started_laying, stage").eq("is_active", true);
    let mortQ = supabase.from("mortality_records").select("date, quantity_dead").gte("date", sixtyDaysAgo);

    if (branch_id) {
      prodQ = prodQ.eq("branch_id", branch_id);
      batchQ = batchQ.eq("branch_id", branch_id);
      mortQ = mortQ.eq("branch_id", branch_id);
    }

    const [prodRes, batchRes, mortRes] = await Promise.all([prodQ, batchQ, mortQ]);

    const prompt = `You are an agricultural data analyst for a Nigerian poultry farm. Based on the following historical production data, active flock information, and mortality trends, predict egg production (in crates) for the next ${days} days.

HISTORICAL PRODUCTION (last 60 days):
${(prodRes.data || []).map(p => `${p.date}: ${p.crates} crates, ${p.pieces} pieces`).join("\n") || "No data"}

ACTIVE FLOCKS:
${(batchRes.data || []).map(b => `${b.species} ${b.species_type || ""} - ${b.current_quantity} birds, ${b.age_weeks} weeks old, stage: ${b.stage || "N/A"}, laying: ${b.has_started_laying}`).join("\n") || "No data"}

RECENT MORTALITY:
${(mortRes.data || []).map(m => `${m.date}: ${m.quantity_dead} dead`).join("\n") || "No data"}

Return a JSON object with:
- "predictions": array of objects with "date" (YYYY-MM-DD) and "predicted_crates" (number) and "confidence" (low/medium/high)
- "factors": array of strings explaining key factors affecting the forecast
- "trend": "increasing", "stable", or "decreasing"
- "summary": a brief natural language summary`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        tools: [{
          type: "function",
          function: {
            name: "production_forecast",
            description: "Return production forecast data",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      predicted_crates: { type: "number" },
                      confidence: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["date", "predicted_crates", "confidence"],
                  },
                },
                factors: { type: "array", items: { type: "string" } },
                trend: { type: "string", enum: ["increasing", "stable", "decreasing"] },
                summary: { type: "string" },
              },
              required: ["predictions", "factors", "trend", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "production_forecast" } },
        messages: [
          { role: "system", content: "You are an expert agricultural data analyst." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const forecast = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(forecast || { error: "No forecast generated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
