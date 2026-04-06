import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, BellOff, Egg } from "lucide-react";
import { toast } from "sonner";

interface EggStockAlertProps {
  expectedOnFarm: number; // in pieces
}

const STORAGE_KEY = "egg_stock_alert_config";

const EggStockAlertConfig = ({ expectedOnFarm }: EggStockAlertProps) => {
  const [enabled, setEnabled] = useState(false);
  const [thresholdCrates, setThresholdCrates] = useState(100);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      setEnabled(config.enabled ?? false);
      setThresholdCrates(config.thresholdCrates ?? 100);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, thresholdCrates }));
  }, [enabled, thresholdCrates]);

  const thresholdPieces = thresholdCrates * 30;
  const isOverThreshold = expectedOnFarm > thresholdPieces;
  const currentCrates = Math.floor(expectedOnFarm / 30);
  const excessCrates = Math.floor((expectedOnFarm - thresholdPieces) / 30);

  // Show alert if enabled and over threshold and not dismissed
  const showAlert = enabled && isOverThreshold && !dismissed;

  return (
    <div className="space-y-3">
      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Egg Stock Alert
          </CardTitle>
          <CardDescription className="text-xs">
            Get warned when eggs on farm exceed a threshold to prevent spoilage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="egg-alert-toggle" className="text-sm">Enable alert</Label>
            <Switch
              id="egg-alert-toggle"
              checked={enabled}
              onCheckedChange={(val) => { setEnabled(val); setDismissed(false); }}
            />
          </div>
          {enabled && (
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Threshold:</Label>
              <Input
                type="number"
                min={1}
                value={thresholdCrates}
                onChange={(e) => setThresholdCrates(Number(e.target.value) || 1)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">crates</span>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Current stock: <strong>{currentCrates} crates</strong> ({expectedOnFarm.toLocaleString()} pcs)
          </div>
        </CardContent>
      </Card>

      {/* Alert Banner */}
      {showAlert && (
        <Card className="border-2 border-warning bg-warning/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  ⚠️ High Egg Stock Warning!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You have <strong>{currentCrates} crates</strong> on farm, which is{" "}
                  <strong>{excessCrates} crates</strong> above your {thresholdCrates}-crate threshold.
                  Consider prioritizing sales to prevent spoilage.
                </p>
                <div className="flex gap-2 mt-3">
                  <Badge className="bg-warning/20 text-warning">
                    {excessCrates} crates excess
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDismissed(true)}
                    className="text-xs"
                  >
                    <BellOff className="h-3 w-3 mr-1" /> Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EggStockAlertConfig;
