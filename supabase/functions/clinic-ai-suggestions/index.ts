import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { animal_type, category, age_weeks, condition, symptoms, severity, treatments, observations } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const treatmentContext = treatments?.length
      ? `\nPrevious treatments administered:\n${treatments.map((t: any) => `- ${t.treatment_description}${t.medication ? ` (${t.medication}${t.dosage ? ` ${t.dosage}` : ''})` : ''}`).join('\n')}`
      : "";

    const observationContext = observations?.length
      ? `\nRecent observations:\n${observations.map((o: any) => `- ${o.observation}`).join('\n')}`
      : "";

    const prompt = `You are an expert veterinary advisor specializing in Nigerian livestock farming.

An animal has been admitted to the farm clinic with the following details:
- Animal Type: ${animal_type}
- Category: ${category}
- Age: ${age_weeks} weeks
- Severity: ${severity}
- Condition: ${condition || 'Unknown'}
- Symptoms: ${symptoms || 'Not specified'}
${treatmentContext}
${observationContext}

Provide expert veterinary suggestions. Include:
1. Likely diagnosis (if condition is unknown, suggest possible conditions based on symptoms)
2. Recommended immediate treatment steps
3. Medications with specific dosages appropriate for the animal type and age
4. Observations to watch for (warning signs)
5. Expected recovery timeline
6. Preventive measures to avoid recurrence

Focus on Nigerian farming context with locally available medications and products. Be specific with product names, dosages, and timing.

Respond in JSON format:
{
  "likely_diagnoses": [
    { "condition": "string", "confidence": "high|medium|low", "explanation": "string" }
  ],
  "immediate_actions": [
    { "action": "string", "priority": "critical|high|medium", "details": "string" }
  ],
  "medications": [
    { "name": "string", "dosage": "string", "frequency": "string", "duration": "string", "notes": "string" }
  ],
  "warning_signs": ["string"],
  "recovery_timeline": "string",
  "prevention_tips": ["string"],
  "general_advice": "string"
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
          { role: "system", content: "You are a veterinary expert. Always respond with valid JSON only, no markdown formatting." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { general_advice: content, likely_diagnoses: [], immediate_actions: [], medications: [], warning_signs: [], recovery_timeline: "Unable to parse", prevention_tips: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
