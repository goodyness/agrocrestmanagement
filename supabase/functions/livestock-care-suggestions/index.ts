import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { species, speciesType, stage, ageWeeks, currentCareHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are an expert livestock farming advisor specializing in Nigerian poultry and livestock management. 

Given the following livestock details:
- Species: ${species}
- Type: ${speciesType || 'General'}
- Current Stage: ${stage}
- Current Age: ${ageWeeks} weeks
- Recent care history: ${currentCareHistory || 'None recorded yet'}

Provide 3-5 specific, actionable care recommendations for RIGHT NOW (this week). Include:
1. Any vaccinations or medications due
2. Feed recommendations and quantities
3. Environmental/housing considerations
4. Health indicators to watch for
5. Any upcoming milestones to prepare for

Focus on Nigerian farming context, local product names, and practical advice. Be specific with product names, dosages, and timing. Format each recommendation with a clear title, description, and urgency level (critical/recommended/optional).

Respond in JSON format:
{
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "urgency": "critical|recommended|optional",
      "care_type": "vaccination|medication|feeding|supplement|observation|other",
      "product_name": "string or null",
      "dosage": "string or null"
    }
  ],
  "next_milestone": "string describing what's coming up next",
  "general_tip": "string with a helpful farming tip"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a livestock farming expert. Always respond with valid JSON only, no markdown formatting." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response, handling potential markdown wrapping
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { recommendations: [], next_milestone: "Unable to parse AI response", general_tip: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
