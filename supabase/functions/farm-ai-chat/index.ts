import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, conversation_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch farm context data for the AI
    const [prodRes, mortalityRes, salesRes, feedRes, livestockRes, clinicRes] = await Promise.all([
      supabase.from("daily_production").select("date, crates, pieces").order("date", { ascending: false }).limit(14),
      supabase.from("mortality_records").select("date, quantity_dead, reason, livestock_categories:livestock_category_id(name)").order("date", { ascending: false }).limit(14),
      supabase.from("sales_records").select("date, product_name, quantity, total_amount").order("date", { ascending: false }).limit(14),
      supabase.from("feed_inventory").select("quantity_in_stock, unit, feed_types:feed_type_id(feed_name)"),
      supabase.from("livestock_batches").select("species, species_type, quantity, current_quantity, age_weeks, stage, is_active, has_started_laying").eq("is_active", true),
      supabase.from("clinic_admissions").select("animal_type, category, status, severity, condition, symptoms").eq("status", "admitted").limit(10),
    ]);

    const farmContext = `You have access to the following real-time farm data:

RECENT PRODUCTION (last 14 days):
${(prodRes.data || []).map(p => `${p.date}: ${p.crates} crates, ${p.pieces} pieces`).join("\n") || "No data"}

RECENT MORTALITY (last 14 days):
${(mortalityRes.data || []).map(m => `${m.date}: ${m.quantity_dead} dead - ${m.reason || "unknown"} (${(m as any).livestock_categories?.name || "unknown"})`).join("\n") || "No data"}

RECENT SALES (last 14 days):
${(salesRes.data || []).map(s => `${s.date}: ${s.product_name} - ${s.quantity} units - ₦${s.total_amount}`).join("\n") || "No data"}

FEED INVENTORY:
${(feedRes.data || []).map(f => `${(f as any).feed_types?.feed_name || "Unknown"}: ${f.quantity_in_stock} ${f.unit}`).join("\n") || "No data"}

ACTIVE BATCHES:
${(livestockRes.data || []).map(b => `${b.species} ${b.species_type || ""} - ${b.current_quantity}/${b.quantity} birds, ${b.age_weeks} weeks old, stage: ${b.stage || "N/A"}, laying: ${b.has_started_laying}`).join("\n") || "No data"}

CLINIC (Currently admitted):
${(clinicRes.data || []).map(c => `${c.animal_type} (${c.category}) - ${c.severity} - ${c.condition || c.symptoms || "unknown"}`).join("\n") || "None"}`;

    const systemPrompt = `You are an expert AI Farm Advisor for Agrocrest Farm, a Nigerian poultry farm. You have deep knowledge of poultry farming, egg production, feed management, livestock health, and Nigerian agricultural practices.

${farmContext}

Guidelines:
- Always reference actual farm data when answering questions
- Provide actionable, specific advice based on Nigerian farming context
- Use Naira (₦) for currency
- Flag any concerning trends you notice (production drops, high mortality, low feed stock)
- Be conversational but professional
- If asked about data you don't have, say so honestly
- Suggest proactive improvements when relevant`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
