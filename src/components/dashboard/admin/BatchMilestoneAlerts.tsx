import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, Syringe, Pill, CheckCircle2 } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

interface MilestoneAlert {
  batchId: string;
  batchLabel: string;
  currentQuantity: number;
  ageWeeks: number;
  templates: any[];
}

const BatchMilestoneAlerts = () => {
  const [alerts, setAlerts] = useState<MilestoneAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentBranchId } = useBranch();

  useEffect(() => {
    fetchAlerts();
  }, [currentBranchId]);

  const fetchAlerts = async () => {
    setLoading(true);

    // Fetch active batches
    let batchQuery = supabase
      .from("livestock_batches")
      .select("id, species, species_type, stage, age_weeks, current_quantity, branch_id")
      .eq("is_active", true);
    if (currentBranchId) batchQuery = batchQuery.eq("branch_id", currentBranchId);

    const { data: batches } = await batchQuery;
    if (!batches || batches.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    // Fetch all templates
    const { data: templates } = await supabase
      .from("livestock_care_templates")
      .select("*")
      .order("week_number");

    if (!templates) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const milestoneAlerts: MilestoneAlert[] = [];

    for (const batch of batches) {
      const relevantTemplates = templates.filter(
        (t) =>
          t.species === batch.species &&
          (!t.species_type || t.species_type === batch.species_type) &&
          t.week_number >= (batch.age_weeks || 0) &&
          t.week_number <= (batch.age_weeks || 0) + 1
      );

      if (relevantTemplates.length > 0) {
        milestoneAlerts.push({
          batchId: batch.id,
          batchLabel: `${batch.species_type || batch.species} (${batch.current_quantity} birds)`,
          currentQuantity: batch.current_quantity,
          ageWeeks: batch.age_weeks || 0,
          templates: relevantTemplates,
        });
      }
    }

    setAlerts(milestoneAlerts);
    setLoading(false);
  };

  if (loading || alerts.length === 0) return null;

  const criticalCount = alerts.reduce(
    (acc, a) => acc + a.templates.filter((t) => t.is_critical).length,
    0
  );

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-600" />
          Livestock Care Milestones
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticalCount} critical
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.batchId} className="space-y-2">
            <p className="text-xs font-medium text-foreground capitalize">
              {alert.batchLabel} • Week {alert.ageWeeks}
            </p>
            {alert.templates.map((t) => (
              <div
                key={t.id}
                className={`flex items-start gap-2 p-2 rounded-md text-xs ${
                  t.is_critical
                    ? "bg-destructive/10 border border-destructive/20"
                    : "bg-muted/50 border border-border/50"
                }`}
              >
                {t.care_type === "vaccination" ? (
                  <Syringe className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                ) : t.care_type === "medication" ? (
                  <Pill className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{t.title}</span>
                    {t.is_critical && (
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0">
                      Wk {t.week_number}
                    </span>
                  </div>
                  {t.product_name && (
                    <span className="text-muted-foreground">
                      💊 {t.product_name}
                      {t.dosage ? ` • ${t.dosage}` : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BatchMilestoneAlerts;
