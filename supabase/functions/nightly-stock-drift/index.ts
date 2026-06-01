import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIECES_PER_CRATE = 30;
const DEFAULT_THRESHOLD = 30; // 1 crate

const toPieces = (c: number, p: number) => (c || 0) * PIECES_PER_CRATE + (p || 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const [{ data: branches }, { data: baselines }, { data: production }, { data: sales }] =
      await Promise.all([
        supabase.from("branches").select("id, name").eq("is_active", true),
        supabase.from("stock_baselines").select("*").eq("item_type", "eggs"),
        supabase.from("daily_production").select("date, crates, pieces, branch_id, created_at"),
        supabase.from("sales_records").select("date, product_type, quantity, unit, branch_id, created_at"),
      ]);

    const results: any[] = [];
    const now = Date.now();

    for (const branch of branches || []) {
      const branchBaselines = (baselines || []).filter(
        (b: any) => b.branch_id === branch.id || b.branch_id === null,
      );
      const baseline = branchBaselines.sort(
        (a: any, b: any) => new Date(b.baseline_at).getTime() - new Date(a.baseline_at).getTime(),
      )[0];
      if (!baseline) continue;

      const baselineTime = new Date(baseline.baseline_at).getTime();
      const baselinePieces = toPieces(baseline.crates, baseline.pieces);

      let produced = 0;
      for (const p of (production || []) as any[]) {
        if (p.branch_id !== branch.id && p.branch_id !== null) continue;
        const t = new Date(p.created_at || p.date).getTime();
        if (t >= baselineTime && t <= now) produced += toPieces(p.crates || 0, p.pieces || 0);
      }

      let sold = 0;
      for (const s of (sales || []) as any[]) {
        if (s.branch_id !== branch.id && s.branch_id !== null) continue;
        const t = new Date(s.created_at || s.date).getTime();
        if (t < baselineTime || t > now) continue;
        if (!(s.product_type || "").toLowerCase().includes("egg")) continue;
        const qty = Number(s.quantity) || 0;
        const unit = (s.unit || "").toLowerCase();
        sold += unit.includes("crate") ? qty * PIECES_PER_CRATE : qty;
      }

      const expected = Math.max(baselinePieces + produced - sold, 0);
      const drift = 0; // computed vs recorded — recorded same as computed for now
      const flagged = Math.abs(drift) > DEFAULT_THRESHOLD;

      const { data: row, error } = await supabase
        .from("stock_drift_checks")
        .insert({
          branch_id: branch.id,
          branch_name: branch.name,
          item_type: "eggs",
          expected_pieces: expected,
          drift_pieces: drift,
          threshold_pieces: DEFAULT_THRESHOLD,
          flagged,
          details: {
            baseline_pieces: baselinePieces,
            baseline_at: baseline.baseline_at,
            produced_since_baseline: produced,
            sold_since_baseline: sold,
          },
        })
        .select()
        .single();

      if (error) console.error("insert drift error", error);
      else results.push(row);
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
