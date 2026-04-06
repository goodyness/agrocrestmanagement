import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useBranch } from "@/contexts/BranchContext";

interface BatchBreakeven {
  id: string;
  species: string;
  speciesType: string | null;
  quantity: number;
  currentQty: number;
  totalInvestment: number;
  totalRevenue: number;
  profitLoss: number;
  breakEvenPercent: number;
  isBreakEven: boolean;
  weeksToBreakEven: number | null;
  ageWeeks: number;
}

const BreakEvenCalculator = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<BatchBreakeven[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let batchQuery = supabase
      .from("livestock_batches")
      .select("*")
      .eq("is_active", true);
    if (currentBranchId) batchQuery = batchQuery.eq("branch_id", currentBranchId);
    const { data: batchData } = await batchQuery;

    if (!batchData) return;

    const results: BatchBreakeven[] = [];

    for (const batch of batchData) {
      // Get expenses for this batch
      const { data: expenses } = await supabase
        .from("miscellaneous_expenses")
        .select("amount")
        .eq("batch_id", batch.id);
      
      const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
      const totalInvestment = Number(batch.total_cost || 0) + totalExpenses;

      // Get revenue from egg sales (if layer)
      let totalRevenue = 0;
      if (batch.has_started_laying) {
        // Estimate revenue based on production period
        const { data: sales } = await supabase
          .from("sales_records")
          .select("total_amount")
          .eq("product_type", "eggs");
        // Approximate attribution based on proportion
        totalRevenue = (sales?.reduce((s, r) => s + Number(r.total_amount), 0) || 0) * 
          (batch.current_quantity / (batchData.reduce((s, b) => s + (b.has_started_laying ? b.current_quantity : 0), 0) || 1));
      }

      const profitLoss = totalRevenue - totalInvestment;
      const breakEvenPercent = totalInvestment > 0 ? Math.min((totalRevenue / totalInvestment) * 100, 100) : 0;
      
      // Estimate weeks to break even based on weekly revenue rate
      const ageWeeks = batch.age_weeks || 0;
      const weeklyRevenue = ageWeeks > 0 ? totalRevenue / Math.max(ageWeeks, 1) : 0;
      const remaining = totalInvestment - totalRevenue;
      const weeksToBreakEven = weeklyRevenue > 0 && remaining > 0 ? Math.ceil(remaining / weeklyRevenue) : null;

      results.push({
        id: batch.id,
        species: batch.species,
        speciesType: batch.species_type,
        quantity: batch.quantity,
        currentQty: batch.current_quantity,
        totalInvestment,
        totalRevenue,
        profitLoss,
        breakEvenPercent,
        isBreakEven: profitLoss >= 0,
        weeksToBreakEven,
        ageWeeks,
      });
    }

    setBatches(results.sort((a, b) => b.breakEvenPercent - a.breakEvenPercent));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Break-Even Calculator
        </CardTitle>
        <CardDescription>Track when each batch becomes profitable</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active batches found</p>
        ) : (
          batches.map((b) => (
            <div key={b.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm text-foreground">
                    {b.species} {b.speciesType ? `(${b.speciesType})` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {b.currentQty}/{b.quantity} birds • {b.ageWeeks}w old
                  </span>
                </div>
                {b.isBreakEven ? (
                  <Badge className="bg-success/20 text-success">
                    <CheckCircle className="h-3 w-3 mr-1" /> Profitable
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-warning">
                    <Clock className="h-3 w-3 mr-1" />
                    {b.weeksToBreakEven ? `~${b.weeksToBreakEven}w` : "Estimating..."}
                  </Badge>
                )}
              </div>
              
              <Progress value={b.breakEvenPercent} className="h-2" />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Invested: ₦{b.totalInvestment.toLocaleString()}</span>
                <span>Revenue: ₦{b.totalRevenue.toLocaleString()}</span>
                <span className={b.profitLoss >= 0 ? "text-success" : "text-destructive"}>
                  {b.profitLoss >= 0 ? "+" : ""}₦{b.profitLoss.toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default BreakEvenCalculator;
