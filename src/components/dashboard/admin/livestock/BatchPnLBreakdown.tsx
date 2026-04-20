import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface Props {
  batch: any;
  careLogs: any[];
  expenses: any[];
}

const BatchPnLBreakdown = ({ batch, careLogs, expenses }: Props) => {
  const [eggRevenue, setEggRevenue] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRevenue = async () => {
      setLoading(true);
      // Egg sales revenue attributed to this batch by branch + product type during batch lifetime
      const fromDate = batch.laying_start_date || batch.date_acquired;
      let q = supabase
        .from("sales_records")
        .select("total_amount, date")
        .eq("product_type", "eggs")
        .gte("date", fromDate);
      if (batch.branch_id) q = q.eq("branch_id", batch.branch_id);
      const { data } = await q;
      const total = data?.reduce((s, r) => s + Number(r.total_amount), 0) || 0;
      setEggRevenue(total);
      setSalesCount(data?.length || 0);
      setLoading(false);
    };
    fetchRevenue();
  }, [batch.id, batch.branch_id, batch.date_acquired, batch.laying_start_date]);

  const breakdown = useMemo(() => {
    const purchaseCost = Number(batch.total_cost || 0);
    const careCost = careLogs.reduce((s, l) => s + Number(l.cost || 0), 0);

    // Group expenses by type
    const byType: Record<string, number> = {};
    let otherExpenses = 0;
    expenses.forEach((e) => {
      const k = e.expense_type || "Other";
      byType[k] = (byType[k] || 0) + Number(e.amount);
      otherExpenses += Number(e.amount);
    });

    const totalInvestment = purchaseCost + otherExpenses + careCost;
    const netProfit = eggRevenue - totalInvestment;
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
    const perAnimal = batch.current_quantity > 0 ? totalInvestment / batch.current_quantity : 0;

    const sortedExpenses = Object.entries(byType).sort((a, b) => b[1] - a[1]);

    return { purchaseCost, careCost, otherExpenses, totalInvestment, netProfit, roi, perAnimal, sortedExpenses };
  }, [batch, careLogs, expenses, eggRevenue]);

  const isLayer = batch.species_type === "layer" || batch.has_started_laying;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Batch Profit & Loss
        </CardTitle>
        <CardDescription className="text-xs">
          Complete financial picture: purchase + all expenses + care vs revenue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-2 rounded bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Purchase</p>
            <p className="font-bold text-sm">₦{breakdown.purchaseCost.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Other Expenses</p>
            <p className="font-bold text-sm">₦{breakdown.otherExpenses.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Care Costs</p>
            <p className="font-bold text-sm">₦{breakdown.careCost.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-primary/10 text-center">
            <p className="text-xs text-muted-foreground">Total Invested</p>
            <p className="font-bold text-sm text-primary">₦{breakdown.totalInvestment.toLocaleString()}</p>
          </div>
        </div>

        {/* Revenue & profit */}
        {isLayer && (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-green-500/10 text-center">
              <p className="text-xs text-muted-foreground">Egg Revenue {loading && "…"}</p>
              <p className="font-bold text-sm text-green-600">₦{eggRevenue.toLocaleString()}</p>
              {salesCount > 0 && <p className="text-[10px] text-muted-foreground">{salesCount} sales</p>}
            </div>
            <div className={`p-2 rounded text-center ${breakdown.netProfit >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
              <p className="text-xs text-muted-foreground">Net Profit</p>
              <p className={`font-bold text-sm ${breakdown.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                ₦{breakdown.netProfit.toLocaleString()}
              </p>
            </div>
            <div className={`p-2 rounded text-center ${breakdown.roi >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
              <p className="text-xs text-muted-foreground">ROI</p>
              <p className={`font-bold text-sm ${breakdown.roi >= 0 ? "text-green-600" : "text-destructive"}`}>
                {breakdown.roi >= 0 ? "+" : ""}{breakdown.roi.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Cost per animal
          </span>
          <span className="font-bold">₦{Math.round(breakdown.perAnimal).toLocaleString()}</span>
        </div>

        {/* Expense breakdown by type */}
        {breakdown.sortedExpenses.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Expenses by Type</p>
            {breakdown.sortedExpenses.map(([type, amount]) => {
              const pct = breakdown.otherExpenses > 0 ? (amount / breakdown.otherExpenses) * 100 : 0;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{type}</Badge>
                    </span>
                    <span className="font-medium">₦{amount.toLocaleString()} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLayer && (
          <p className="text-xs text-muted-foreground italic">
            💡 Revenue tracking activates once batch starts laying or is sold.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default BatchPnLBreakdown;
