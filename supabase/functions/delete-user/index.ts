import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const caller = userRes?.user;
    if (!caller) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (callerProfile?.role !== "admin") throw new Error("Forbidden — admin only");

    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== "string") throw new Error("user_id required");
    if (user_id === caller.id) throw new Error("Cannot delete yourself");

    // Delete auth user — profile row cascades via profiles_id_fkey ON DELETE CASCADE.
    // Historical records (mortality, expenses, care logs, etc.) survive because
    // their recorded_by/created_by/administered_by FKs are SET NULL.
    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
