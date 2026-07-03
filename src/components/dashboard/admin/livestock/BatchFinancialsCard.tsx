import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wallet, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

interface Props { batchId: string; refreshKey?: number }

export default function BatchFinancialsCard({ batchId, refreshKey }: Props) {
  const [f, setF] = useState({ budget: 0, admin_contribution: 0, partner_contribution: 0, total_expenses: 0, total_sales: 0, gross_profit: 0, remaining_budget: 0 });

  useEffect(() => {
    if (!batchId) return;
    supabase.rpc("get_batch_financials", { _batch_id: batchId } as any).then(({ data }) => {
      if (data && (data as any).length) setF((data as any)[0]);
    });
  }, [batchId, refreshKey]);

  const budget = Number(f.budget || 0);
  const spent = Number(f.total_expenses || 0);
  const sales = Number(f.total_sales || 0);
  const profit = Number(f.gross_profit || 0);
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const overBudget = spent > budget && budget > 0;
  const inProfit = profit > 0;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Batch Financials</p>
          <Badge variant={inProfit ? "default" : overBudget ? "destructive" : "secondary"}>
            {inProfit ? "In Profit" : overBudget ? "Over Budget" : "Building"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Budget" value={budget} icon={<Wallet className="h-3 w-3" />} />
          <Stat label="Spent" value={spent} tone="warn" icon={<DollarSign className="h-3 w-3" />} />
          <Stat label="Sales" value={sales} tone="ok" icon={<TrendingUp className="h-3 w-3" />} />
          <Stat label={profit >= 0 ? "Gross Profit" : "Deficit"} value={Math.abs(profit)} tone={inProfit ? "ok" : "warn"} icon={<DollarSign className="h-3 w-3" />} />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Budget usage</span>
            <span className={overBudget ? "text-destructive font-semibold" : ""}>{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className={overBudget ? "bg-destructive/20" : ""} />
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>Admin: ₦{Number(f.admin_contribution || 0).toLocaleString()}</span>
            <span>Partner: ₦{Number(f.partner_contribution || 0).toLocaleString()}</span>
            <span>Remaining: ₦{Number(f.remaining_budget || 0).toLocaleString()}</span>
          </div>
        </div>

        {!inProfit && sales > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2 text-[11px]">
            <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>Sales must cover total expenses before profit accrues. Need ₦{Math.max(0, spent - sales).toLocaleString()} more in sales to break even.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "ok" | "warn" }) {
  const cls = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon} {label}</p>
      <p className={`text-sm font-bold ${cls}`}>₦{value.toLocaleString()}</p>
    </div>
  );
}
