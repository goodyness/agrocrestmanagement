import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Skull, Wheat, Check, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

interface Anomaly {
  id: string;
  alert_type: string;
  severity: string;
  metric_value: number;
  baseline_value: number;
  description: string;
  is_acknowledged: boolean;
  created_at: string;
}

const AnomalyAlertsWidget = () => {
  const { currentBranchId } = useBranch();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchAnomalies();
  }, [currentBranchId]);

  const fetchAnomalies = async () => {
    setLoading(true);
    let query = supabase
      .from("anomaly_alerts")
      .select("*")
      .eq("is_acknowledged", false)
      .order("created_at", { ascending: false })
      .limit(10);
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data } = await query;
    setAnomalies((data as Anomaly[]) || []);
    setLoading(false);
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-anomalies", {
        body: { branch_id: currentBranchId },
      });
      if (error) throw error;
      toast.success(`Scan complete — ${data?.count || 0} anomalies detected`);
      fetchAnomalies();
    } catch (err: any) {
      toast.error("Scan failed: " + (err.message || "Unknown error"));
    }
    setScanning(false);
  };

  const acknowledge = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("anomaly_alerts")
      .update({ is_acknowledged: true, acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    setAnomalies(prev => prev.filter(a => a.id !== id));
    toast.success("Alert acknowledged");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "production_drop": return <TrendingDown className="h-4 w-4" />;
      case "mortality_spike": return <Skull className="h-4 w-4" />;
      case "feed_anomaly": return <Wheat className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "production_drop": return "Production Drop";
      case "mortality_spike": return "Mortality Spike";
      case "feed_anomaly": return "Feed Anomaly";
      default: return type;
    }
  };

  if (anomalies.length === 0 && !loading) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-success" />
              Anomaly Detection
            </CardTitle>
            <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
              {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="ml-1 hidden sm:inline">Scan</span>
            </Button>
          </div>
          <CardDescription>No active anomalies detected ✅</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Anomaly Alerts ({anomalies.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="ml-1 hidden sm:inline">Re-scan</span>
          </Button>
        </div>
        <CardDescription>Unusual patterns detected — review and acknowledge</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {anomalies.map((anomaly) => (
          <div key={anomaly.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-background border">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${anomaly.severity === "critical" ? "text-destructive" : "text-amber-500"}`}>
                {getIcon(anomaly.alert_type)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{getTypeLabel(anomaly.alert_type)}</span>
                  <Badge variant={anomaly.severity === "critical" ? "destructive" : "secondary"} className="text-xs">
                    {anomaly.severity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{anomaly.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(anomaly.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => acknowledge(anomaly.id)} title="Acknowledge">
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AnomalyAlertsWidget;
