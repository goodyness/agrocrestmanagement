import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Increment age_weeks by 1 for all active batches
    const { data, error } = await supabase
      .from("livestock_batches")
      .update({ age_weeks: supabase.rpc ? undefined : undefined })
      .eq("is_active", true);

    // Use raw SQL via rpc for atomic increment
    const { error: rpcError } = await supabase.rpc("increment_batch_ages");
    
    if (rpcError) {
      // Fallback: fetch and update individually
      const { data: batches } = await supabase
        .from("livestock_batches")
        .select("id, age_weeks")
        .eq("is_active", true);

      if (batches) {
        for (const batch of batches) {
          await supabase
            .from("livestock_batches")
            .update({ age_weeks: (batch.age_weeks || 0) + 1 })
            .eq("id", batch.id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Batch ages incremented" }), {
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
