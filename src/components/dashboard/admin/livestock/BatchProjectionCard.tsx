import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

interface Props { batchId: string; batch: any; isAdmin: boolean; refreshKey?: number }

export default function BatchProjectionCard({ batchId, batch, isAdmin, refreshKey }: Props) {
  const [proj, setProj] = useState<any | null>(null);
  const [mode, setMode] = useState<"per_bird" | "per_kg">("per_bird");
  const [weeks, setWeeks] = useState("");
  const [pricePerBird, setPricePerBird] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("batch_projections").select("*").eq("batch_id", batchId).maybeSingle();
    if (data) {
      setProj(data);
      setMode((data.mode as any) || "per_bird");
      setWeeks(String(data.weeks_to_raise ?? ""));
      setPricePerBird(String(data.expected_price_per_bird ?? ""));
      setPricePerKg(String(data.expected_price_per_kg ?? ""));
      setAvgWeight(String(data.expected_avg_weight_kg ?? ""));
    }
  };
  useEffect(() => { if (batchId) load(); }, [batchId, refreshKey]);

  const save = async () => {
    setSaving(true);
    const payload: any = {
      batch_id: batchId,
      mode,
      weeks_to_raise: parseInt(weeks) || null,
      expected_price_per_bird: parseFloat(pricePerBird) || null,
      expected_price_per_kg: parseFloat(pricePerKg) || null,
      expected_avg_weight_kg: parseFloat(avgWeight) || null,
    };
    const { error } = proj
      ? await supabase.from("batch_projections").update(payload).eq("id", proj.id)
      : await supabase.from("batch_projections").insert([payload] as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Projection saved");
    load();
  };

  const qty = Number(batch?.current_quantity || 0);
  const expectedRevenue = mode === "per_bird"
    ? qty * (parseFloat(pricePerBird) || 0)
    : qty * (parseFloat(avgWeight) || 0) * (parseFloat(pricePerKg) || 0);
  const budget = Number(batch?.budget || 0);
  const projectedProfit = expectedRevenue - budget;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Projected Sale & Profit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdmin ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Mode</Label>
                <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_bird">Price per bird</SelectItem>
                    <SelectItem value="per_kg">Price per kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weeks to raise</Label>
                <Input type="number" min={0} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
              </div>
              {mode === "per_bird" ? (
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Expected price / bird (₦)</Label>
                  <Input type="number" min={0} value={pricePerBird} onChange={(e) => setPricePerBird(e.target.value)} />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Avg weight (kg)</Label>
                    <Input type="number" min={0} step="0.1" value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price / kg (₦)</Label>
                    <Input type="number" min={0} value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Projection"}</Button>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Admin sets the projection for this batch.</div>
        )}

        {expectedRevenue > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground">Projected Revenue</p>
              <p className="text-sm font-bold text-emerald-600">₦{expectedRevenue.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground">Projected Profit (vs budget)</p>
              <p className={`text-sm font-bold ${projectedProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>₦{projectedProfit.toLocaleString()}</p>
            </div>
            {weeks && (
              <div className="col-span-2 text-[11px] text-muted-foreground">
                Based on raising for {weeks} weeks • {qty} animals current
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
