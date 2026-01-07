import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Settings } from "lucide-react";
import { toast } from "sonner";

interface LowStockAlertDialogProps {
  feedTypes: any[];
  onSuccess: () => void;
}

interface AlertSetting {
  id?: string;
  feed_type_id: string;
  threshold_quantity: number;
  threshold_unit: string;
  is_active: boolean;
  feed_name?: string;
}

const LowStockAlertDialog = ({ feedTypes, onSuccess }: LowStockAlertDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertSetting[]>([]);

  useEffect(() => {
    if (open) {
      fetchAlerts();
    }
  }, [open, feedTypes]);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from("low_stock_alerts")
      .select("*, feed_types(feed_name)");

    // Merge existing alerts with feed types
    const alertMap = new Map(data?.map(a => [a.feed_type_id, a]) || []);
    
    const mergedAlerts = feedTypes.map(ft => {
      const existing = alertMap.get(ft.id);
      return {
        id: existing?.id,
        feed_type_id: ft.id,
        threshold_quantity: existing?.threshold_quantity || 50,
        threshold_unit: existing?.threshold_unit || "kg",
        is_active: existing?.is_active ?? false,
        feed_name: ft.feed_name,
      };
    });

    setAlerts(mergedAlerts);
  };

  const updateAlert = (feedTypeId: string, field: string, value: any) => {
    setAlerts(prev => prev.map(a => 
      a.feed_type_id === feedTypeId ? { ...a, [field]: value } : a
    ));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      for (const alert of alerts) {
        if (alert.id) {
          // Update existing
          await supabase
            .from("low_stock_alerts")
            .update({
              threshold_quantity: alert.threshold_quantity,
              threshold_unit: alert.threshold_unit,
              is_active: alert.is_active,
              updated_at: new Date().toISOString(),
            })
            .eq("id", alert.id);
        } else if (alert.is_active) {
          // Create new if active
          await supabase.from("low_stock_alerts").insert({
            feed_type_id: alert.feed_type_id,
            threshold_quantity: alert.threshold_quantity,
            threshold_unit: alert.threshold_unit,
            is_active: alert.is_active,
          });
        }
      }

      toast.success("Alert settings saved");
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error("Failed to save alert settings");
      console.error(error);
    }

    setLoading(false);
  };

  const sendTestAlert = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-low-stock-alert", {
        body: { test: true },
      });

      if (error) throw error;
      toast.success("Test alert email sent!");
    } catch (error: any) {
      toast.error("Failed to send test alert: " + error.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Bell className="h-4 w-4 mr-2" />
          Stock Alerts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Low Stock Alert Settings
          </DialogTitle>
          <DialogDescription>
            Configure email notifications when feed inventory drops below threshold
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add feed types first to configure alerts
            </p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.feed_type_id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{alert.feed_name}</h4>
                  <Switch
                    checked={alert.is_active}
                    onCheckedChange={(checked) => updateAlert(alert.feed_type_id, "is_active", checked)}
                  />
                </div>
                
                {alert.is_active && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Threshold Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={alert.threshold_quantity}
                        onChange={(e) => updateAlert(alert.feed_type_id, "threshold_quantity", parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <select
                        value={alert.threshold_unit}
                        onChange={(e) => updateAlert(alert.feed_type_id, "threshold_unit", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="kg">Kg</option>
                        <option value="bags">Bags</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={sendTestAlert} disabled={loading} className="flex-1">
            Send Test Alert
          </Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LowStockAlertDialog;
