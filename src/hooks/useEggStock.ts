import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PIECES_PER_CRATE = 30;

export const toPieces = (crates: number, pieces: number) =>
  (crates || 0) * PIECES_PER_CRATE + (pieces || 0);

export const piecesToDisplay = (total: number) => ({
  crates: Math.floor(total / PIECES_PER_CRATE),
  pieces: total % PIECES_PER_CRATE,
});

export const formatEggs = (total: number) => {
  const { crates, pieces } = piecesToDisplay(total);
  return `${crates}c ${pieces}p`;
};

interface Baseline {
  id: string;
  branch_id: string | null;
  item_type: string;
  crates: number;
  pieces: number;
  baseline_at: string;
}
interface ProductionRow { date: string; crates: number; pieces: number; branch_id: string | null; created_at?: string; }
interface SalesRow { date: string; product_type: string; quantity: number; unit: string; branch_id: string | null; created_at?: string; }

interface EggStockBreakdown {
  baseline: Baseline | null;
  baselinePieces: number;
  producedSinceBaseline: number;
  soldSinceBaseline: number;
  expectedPieces: number | null;
}

/**
 * Canonical egg-stock computation shared by Expected Stock and Expected Profit tabs.
 *
 * Formula: baseline + Σ production since baseline − Σ egg sales since baseline.
 * Uses created_at when available (falls back to date) so back-dated entries are
 * still anchored to when they were recorded — matches the Expected Stock tab,
 * which the user has confirmed as the source of truth.
 */
export function computeExpectedEggStock(
  branchId: string | null | undefined,
  baselines: Baseline[],
  production: ProductionRow[],
  sales: SalesRow[],
  asOf: Date = new Date()
): EggStockBreakdown {
  const inBranch = (row: { branch_id: string | null }) =>
    !branchId || row.branch_id === branchId || row.branch_id === null;

  const baseline =
    baselines
      .filter((b) => b.item_type === "eggs" && inBranch(b))
      .sort((a, b) => new Date(b.baseline_at).getTime() - new Date(a.baseline_at).getTime())[0] || null;

  if (!baseline) {
    return { baseline: null, baselinePieces: 0, producedSinceBaseline: 0, soldSinceBaseline: 0, expectedPieces: null };
  }

  const baselineTime = new Date(baseline.baseline_at).getTime();
  const asOfTime = asOf.getTime();
  const baselinePieces = toPieces(baseline.crates, baseline.pieces);

  let produced = 0;
  production.filter(inBranch).forEach((p) => {
    const t = new Date(p.created_at || p.date).getTime();
    if (t >= baselineTime && t <= asOfTime) produced += toPieces(p.crates || 0, p.pieces || 0);
  });

  let sold = 0;
  sales.filter(inBranch).forEach((s) => {
    const t = new Date(s.created_at || s.date).getTime();
    if (t < baselineTime || t > asOfTime) return;
    if (!(s.product_type || "").toLowerCase().includes("egg")) return;
    const qty = Number(s.quantity) || 0;
    const unit = (s.unit || "").toLowerCase();
    sold += unit.includes("crate") ? qty * PIECES_PER_CRATE : qty;
  });

  return {
    baseline,
    baselinePieces,
    producedSinceBaseline: produced,
    soldSinceBaseline: sold,
    expectedPieces: Math.max(baselinePieces + produced - sold, 0),
  };
}

/**
 * React hook that loads baselines + production + sales and returns the
 * canonical expected egg stock for a branch.
 */
export function useEggStock(branchId: string | null | undefined) {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [production, setProduction] = useState<ProductionRow[]>([]);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [b, p, s] = await Promise.all([
        supabase.from("stock_baselines").select("id, branch_id, item_type, crates, pieces, baseline_at").eq("item_type", "eggs"),
        supabase.from("daily_production").select("date, crates, pieces, branch_id, created_at"),
        supabase.from("sales_records").select("date, product_type, quantity, unit, branch_id, created_at"),
      ]);
      if (cancelled) return;
      setBaselines((b.data as Baseline[]) || []);
      setProduction((p.data as ProductionRow[]) || []);
      setSales((s.data as SalesRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const breakdown = useMemo(
    () => computeExpectedEggStock(branchId, baselines, production, sales),
    [branchId, baselines, production, sales]
  );

  return { ...breakdown, loading };
}
