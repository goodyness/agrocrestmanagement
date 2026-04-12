import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { branch_id } = await req.json().catch(() => ({}));
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];

    // Fetch recent and baseline data
    let prodRecentQ = supabase.from("daily_production").select("date, crates, pieces").gte("date", threeDaysAgo);
    let prodBaselineQ = supabase.from("daily_production").select("date, crates").gte("date", thirtyDaysAgo).lt("date", threeDaysAgo);
    let mortRecentQ = supabase.from("mortality_records").select("date, quantity_dead").gte("date", threeDaysAgo);
    let mortBaselineQ = supabase.from("mortality_records").select("date, quantity_dead").gte("date", thirtyDaysAgo).lt("date", threeDaysAgo);
    let feedRecentQ = supabase.from("feed_consumption").select("date, quantity_used").gte("date", threeDaysAgo);
    let feedBaselineQ = supabase.from("feed_consumption").select("date, quantity_used").gte("date", thirtyDaysAgo).lt("date", threeDaysAgo);

    if (branch_id) {
      prodRecentQ = prodRecentQ.eq("branch_id", branch_id);
      prodBaselineQ = prodBaselineQ.eq("branch_id", branch_id);
      mortRecentQ = mortRecentQ.eq("branch_id", branch_id);
      mortBaselineQ = mortBaselineQ.eq("branch_id", branch_id);
      feedRecentQ = feedRecentQ.eq("branch_id", branch_id);
      feedBaselineQ = feedBaselineQ.eq("branch_id", branch_id);
    }

    const [prodRecent, prodBaseline, mortRecent, mortBaseline, feedRecent, feedBaseline] = await Promise.all([
      prodRecentQ, prodBaselineQ, mortRecentQ, mortBaselineQ, feedRecentQ, feedBaselineQ,
    ]);

    const anomalies: any[] = [];

    // Production drop detection
    const recentProdAvg = (prodRecent.data || []).reduce((s, p) => s + p.crates, 0) / Math.max((prodRecent.data || []).length, 1);
    const baselineProdDays = new Set((prodBaseline.data || []).map(p => p.date)).size || 1;
    const baselineProdAvg = (prodBaseline.data || []).reduce((s, p) => s + p.crates, 0) / baselineProdDays;

    if (baselineProdAvg > 0 && recentProdAvg < baselineProdAvg * 0.8) {
      const dropPct = Math.round((1 - recentProdAvg / baselineProdAvg) * 100);
      anomalies.push({
        alert_type: "production_drop",
        severity: dropPct > 40 ? "critical" : "warning",
        metric_value: Math.round(recentProdAvg),
        baseline_value: Math.round(baselineProdAvg),
        description: `Production dropped ${dropPct}% — Recent avg: ${Math.round(recentProdAvg)} crates vs baseline: ${Math.round(baselineProdAvg)} crates`,
        branch_id: branch_id || null,
      });
    }

    // Mortality spike detection
    const recentMortTotal = (mortRecent.data || []).reduce((s, m) => s + m.quantity_dead, 0);
    const recentMortDays = Math.max(new Set((mortRecent.data || []).map(m => m.date)).size, 1);
    const recentMortAvg = recentMortTotal / recentMortDays;
    const baselineMortDays = Math.max(new Set((mortBaseline.data || []).map(m => m.date)).size, 1);
    const baselineMortAvg = (mortBaseline.data || []).reduce((s, m) => s + m.quantity_dead, 0) / baselineMortDays;

    if (baselineMortAvg > 0 && recentMortAvg > baselineMortAvg * 3) {
      anomalies.push({
        alert_type: "mortality_spike",
        severity: "critical",
        metric_value: Math.round(recentMortAvg),
        baseline_value: Math.round(baselineMortAvg),
        description: `Mortality spiked ${Math.round(recentMortAvg / baselineMortAvg)}x — Recent avg: ${Math.round(recentMortAvg)}/day vs baseline: ${Math.round(baselineMortAvg)}/day`,
        branch_id: branch_id || null,
      });
    } else if (baselineMortAvg > 0 && recentMortAvg > baselineMortAvg * 2) {
      anomalies.push({
        alert_type: "mortality_spike",
        severity: "warning",
        metric_value: Math.round(recentMortAvg),
        baseline_value: Math.round(baselineMortAvg),
        description: `Mortality elevated ${Math.round(recentMortAvg / baselineMortAvg)}x above normal`,
        branch_id: branch_id || null,
      });
    }

    // Feed consumption anomaly
    const recentFeedAvg = (feedRecent.data || []).reduce((s, f) => s + Number(f.quantity_used), 0) / Math.max(new Set((feedRecent.data || []).map(f => f.date)).size, 1);
    const baselineFeedAvg = (feedBaseline.data || []).reduce((s, f) => s + Number(f.quantity_used), 0) / Math.max(new Set((feedBaseline.data || []).map(f => f.date)).size, 1);

    if (baselineFeedAvg > 0) {
      const feedDeviation = Math.abs(recentFeedAvg - baselineFeedAvg) / baselineFeedAvg;
      if (feedDeviation > 0.3) {
        const direction = recentFeedAvg > baselineFeedAvg ? "increased" : "decreased";
        anomalies.push({
          alert_type: "feed_anomaly",
          severity: feedDeviation > 0.5 ? "critical" : "warning",
          metric_value: Math.round(recentFeedAvg * 100) / 100,
          baseline_value: Math.round(baselineFeedAvg * 100) / 100,
          description: `Feed consumption ${direction} ${Math.round(feedDeviation * 100)}% from baseline`,
          branch_id: branch_id || null,
        });
      }
    }

    // Store anomalies
    if (anomalies.length > 0) {
      await supabase.from("anomaly_alerts").insert(anomalies);
    }

    return new Response(JSON.stringify({ anomalies, count: anomalies.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
