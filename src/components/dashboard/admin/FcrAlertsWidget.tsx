import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

const FcrAlertsWidget = () => {
  const { currentBranchId } = useBranch();
  const [fcrThreshold, setFcrThreshold] = useState(2.5);
  const [batchFcrs, setBatchFcrs] = useState<any[]>([]);

  useEffect(() => {
    calculateBatchFcrs();
  }, [currentBranchId]);

  const calculateBatchFcrs = async () => {
    let batchQ = supabase.from("livestock_batches").select("id, species, species_type, current_quantity, age_weeks").eq("is_active", true).eq("has_started_laying", true);
    if (currentBranchId) batchQ = batchQ.eq("branch_id", currentBranchId);
    const { data: batches } = await batchQ;
    if (!batches?.length) { setBatchFcrs([]); return; }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

    let feedQ = supabase.from("feed_consumption").select("quantity_used, unit").gte("date", dateStr);
    if (currentBranchId) feedQ = feedQ.eq("branch_id", currentBranchId);
    const { data: feedData } = await feedQ;

    let prodQ = supabase.from("daily_production").select("crates, pieces").gte("date", dateStr);
    if (currentBranchId) prodQ = prodQ.eq("branch_id", currentBranchId);
    const { data: prodData } = await prodQ;

    const totalFeedKg = (feedData || []).reduce((sum, f) => sum + Number(f.quantity_used), 0);
    const totalEggs = (prodData || []).reduce((sum, p) => sum + (p.crates * 30 + p.pieces), 0);
    const totalDozens = totalEggs / 12;
    const overallFcr = totalDozens > 0 ? totalFeedKg / totalDozens : 0;

    const results = batches.map(b => ({
      ...b,
      fcr: overallFcr,
      status: overallFcr === 0 ? "no_data" : overallFcr <= 2.0 ? "excellent" : overallFcr <= fcrThreshold ? "good" : "alert",
    }));

    setBatchFcrs(results);
  };

  const alertBatches = batchFcrs.filter(b => b.status === "alert");

  return (
    <Card className={alertBatches.length > 0 ? "border-destructive/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            FCR Alerts
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Threshold:</Label>
            <Input
              type="number"
              step="0.1"
              min="1"
              max="5"
              value={fcrThreshold}
              onChange={e => setFcrThreshold(+e.target.value)}
              className="w-16 h-7 text-xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alertBatches.length > 0 ? (
          alertBatches.map(b => (
            <div key={b.id} className="flex items-center justify-between p-2 bg-destructive/10 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">{b.species} {b.species_type || ""}</span>
              </div>
              <Badge variant="destructive">FCR: {b.fcr.toFixed(2)}</Badge>
            </div>
          ))
        ) : batchFcrs.length > 0 ? (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="text-sm">All batches within FCR threshold ({fcrThreshold})</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">No laying batches found</p>
        )}
        <p className="text-xs text-muted-foreground">FCR = kg feed per dozen eggs (30-day avg). Target: ≤ {fcrThreshold}</p>
      </CardContent>
    </Card>
  );
};

export default FcrAlertsWidget;
