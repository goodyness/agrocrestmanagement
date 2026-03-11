import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

interface BatchInvestment {
  id: string;
  species: string;
  species_type: string | null;
  quantity: number;
  current_quantity: number;
  total_cost: number;
  age_weeks: number | null;
  is_active: boolean;
  expenses: number;
  sales: number;
}

const LivestockInvestmentWidget = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<BatchInvestment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch active batches
    let batchQuery = supabase
      .from("livestock_batches")
      .select("id, species, species_type, quantity, current_quantity, total_cost, age_weeks, is_active")
      .eq("is_active", true);
    if (currentBranchId) batchQuery = batchQuery.eq("branch_id", currentBranchId);
    const { data: batchData } = await batchQuery;

    if (!batchData || batchData.length === 0) {
      setBatches([]);
      setLoading(false);
      return;
    }

    const batchIds = batchData.map((b) => b.id);

    // Fetch expenses for these batches
    let expQuery = supabase
      .from("miscellaneous_expenses")
      .select("batch_id, amount")
      .in("batch_id", batchIds);
    const { data: expData } = await expQuery;

    // Fetch sales linked to livestock (product_type = 'livestock' or similar)
    let salesQuery = supabase
      .from("sales_records")
      .select("total_amount");
    if (currentBranchId) salesQuery = salesQuery.eq("branch_id", currentBranchId);
    salesQuery = salesQuery.eq("product_type", "livestock");
    const { data: salesData } = await salesQuery;

    const totalLivestockSales = salesData?.reduce((s, r) => s + Number(r.total_amount), 0) || 0;

    // Map expenses to batches
    const expByBatch: Record<string, number> = {};
    expData?.forEach((e) => {
      if (e.batch_id) {
        expByBatch[e.batch_id] = (expByBatch[e.batch_id] || 0) + Number(e.amount);
      }
    });

    const enriched: BatchInvestment[] = batchData.map((b) => ({
      ...b,
      total_cost: Number(b.total_cost || 0),
      expenses: expByBatch[b.id] || 0,
      sales: 0, // individual batch sales not tracked yet
    }));

    setBatches(enriched);
    setLoading(false);
  };

  const totalPurchaseCost = batches.reduce((s, b) => s + b.total_cost, 0);
  const totalExpenses = batches.reduce((s, b) => s + b.expenses, 0);
  const totalInvestment = totalPurchaseCost + totalExpenses;
  const totalBirds = batches.reduce((s, b) => s + b.current_quantity, 0);
  const totalMortality = batches.reduce((s, b) => s + (b.quantity - b.current_quantity), 0);
  const avgCostPerBird = totalBirds > 0 ? totalInvestment / totalBirds : 0;
  const mortalityRate = batches.reduce((s, b) => s + b.quantity, 0) > 0
    ? (totalMortality / batches.reduce((s, b) => s + b.quantity, 0)) * 100
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading investment data...</CardContent>
      </Card>
    );
  }

  if (batches.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Livestock Investment Summary
        </CardTitle>
        <CardDescription>{batches.length} active batch{batches.length !== 1 ? "es" : ""} • {totalBirds.toLocaleString()} animals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Purchase Cost</p>
            <p className="text-lg font-bold">₦{totalPurchaseCost.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Added Expenses</p>
            <p className="text-lg font-bold">₦{totalExpenses.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-center">
            <p className="text-xs text-muted-foreground">Total Investment</p>
            <p className="text-lg font-bold text-primary">₦{totalInvestment.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Cost/Bird</p>
            <p className="text-lg font-bold">₦{avgCostPerBird.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* Mortality impact */}
        {totalMortality > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-destructive/5 border border-destructive/20">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-sm">
              <strong>{totalMortality}</strong> mortality ({mortalityRate.toFixed(1)}%) — estimated loss: ₦{(totalMortality * avgCostPerBird).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Per-batch breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Per Batch</p>
          {batches.map((b) => {
            const batchInvestment = b.total_cost + b.expenses;
            const batchMortality = b.quantity - b.current_quantity;
            return (
              <div key={b.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{b.species_type || b.species}</Badge>
                  <span>{b.current_quantity}/{b.quantity} birds</span>
                  {b.age_weeks != null && <span className="text-muted-foreground">• {b.age_weeks}wks</span>}
                </div>
                <div className="flex items-center gap-3">
                  {batchMortality > 0 && (
                    <span className="text-xs text-destructive">-{batchMortality}</span>
                  )}
                  <span className="font-medium">₦{batchInvestment.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LivestockInvestmentWidget;
