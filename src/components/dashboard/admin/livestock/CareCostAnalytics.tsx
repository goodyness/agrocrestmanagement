import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface Props {
  logs: any[];
  currentQuantity: number;
}

const CareCostAnalytics = ({ logs, currentQuantity }: Props) => {
  const stats = useMemo(() => {
    const total = logs.reduce((s, l) => s + Number(l.cost || 0), 0);
    const byType: Record<string, number> = {};
    logs.forEach((l) => {
      const k = l.care_type;
      byType[k] = (byType[k] || 0) + Number(l.cost || 0);
    });
    const sorted = Object.entries(byType)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    return { total, perAnimal: currentQuantity > 0 ? total / currentQuantity : 0, byType: sorted };
  }, [logs, currentQuantity]);

  if (stats.total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Care Cost Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 rounded bg-muted/50">
            <p className="text-lg font-bold">₦{stats.total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Care Cost</p>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <p className="text-lg font-bold text-primary">₦{Math.round(stats.perAnimal).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Per Animal</p>
          </div>
        </div>

        {stats.byType.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">By Care Type</p>
            {stats.byType.map(([type, amount]) => {
              const pct = (amount / stats.total) * 100;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize">{type}</span>
                    <span className="font-medium">₦{amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CareCostAnalytics;
