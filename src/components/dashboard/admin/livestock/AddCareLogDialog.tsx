import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  branchId: string | null;
  batchQuantity: number;
  onSuccess: () => void;
}

const CARE_TYPES = [
  { value: "vaccination", label: "💉 Vaccination", defaultWithdrawal: 0 },
  { value: "medication", label: "💊 Medication", defaultWithdrawal: 7 },
  { value: "antibiotics", label: "🧪 Antibiotics", defaultWithdrawal: 14 },
  { value: "feeding", label: "🌾 Feeding", defaultWithdrawal: 0 },
  { value: "supplement", label: "🧴 Supplement / Vitamin", defaultWithdrawal: 0 },
  { value: "deworming", label: "🪱 Deworming", defaultWithdrawal: 7 },
  { value: "observation", label: "👁️ Observation", defaultWithdrawal: 0 },
  { value: "other", label: "📋 Other", defaultWithdrawal: 0 },
];

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const AddCareLogDialog = ({ open, onOpenChange, batchId, branchId, batchQuantity, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "range">("single");
  const [careType, setCareType] = useState("");
  const [description, setDescription] = useState("");
  const [productName, setProductName] = useState("");
  const [dosage, setDosage] = useState("");
  const [quantityAffected, setQuantityAffected] = useState(batchQuantity);
  const [careDate, setCareDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(addDays(new Date().toISOString().split("T")[0], 4));
  const [withdrawalDays, setWithdrawalDays] = useState(0);
  const [costPerDay, setCostPerDay] = useState("");
  const [notes, setNotes] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    if (open) {
      supabase.from("care_log_templates").select("*").order("name").then(({ data }) => {
        setTemplates(data || []);
      });
    }
  }, [open]);

  useEffect(() => {
    setQuantityAffected(batchQuantity);
  }, [batchQuantity, open]);

  const applyTemplate = (id: string) => {
    setSelectedTemplate(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setCareType(t.care_type);
    setDescription(t.description || "");
    setProductName(t.product_name || "");
    setDosage(t.dosage || "");
    setWithdrawalDays(t.withdrawal_days || 0);
    setCostPerDay(t.default_cost ? String(t.default_cost) : "");
    if (t.duration_days > 1) {
      setMode("range");
      setEndDate(addDays(careDate, t.duration_days - 1));
    } else {
      setMode("single");
    }
  };

  const onCareTypeChange = (val: string) => {
    setCareType(val);
    const t = CARE_TYPES.find((c) => c.value === val);
    if (t && withdrawalDays === 0) setWithdrawalDays(t.defaultWithdrawal);
  };

  const reset = () => {
    setMode("single");
    setCareType("");
    setDescription("");
    setProductName("");
    setDosage("");
    setNotes("");
    setWithdrawalDays(0);
    setCostPerDay("");
    setSelectedTemplate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    // Build the date range
    const start = careDate;
    const end = mode === "range" ? endDate : careDate;
    if (mode === "range" && new Date(end) < new Date(start)) {
      toast.error("End date must be on or after start date");
      setLoading(false);
      return;
    }

    const dates: string[] = [];
    let cursor = new Date(start);
    const endD = new Date(end);
    while (cursor <= endD) {
      dates.push(cursor.toISOString().split("T")[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const courseId = mode === "range" ? crypto.randomUUID() : null;
    const totalDays = dates.length;
    const cost = Number(costPerDay) || 0;

    const rows = dates.map((d, i) => ({
      batch_id: batchId,
      branch_id: branchId,
      care_date: d,
      care_type: careType,
      description,
      product_name: productName || null,
      dosage: dosage || null,
      quantity_affected: quantityAffected || null,
      administered_by: user.id,
      notes: notes || null,
      course_id: courseId,
      course_start_date: mode === "range" ? start : null,
      course_end_date: mode === "range" ? end : null,
      course_day_number: mode === "range" ? i + 1 : null,
      course_total_days: mode === "range" ? totalDays : null,
      withdrawal_days: withdrawalDays || 0,
      withdrawal_end_date: withdrawalDays > 0 ? addDays(d, withdrawalDays) : null,
      cost,
    }));

    const { error } = await supabase.from("livestock_care_logs").insert(rows);

    if (error) {
      toast.error("Failed to log care: " + error.message);
    } else {
      toast.success(
        mode === "range"
          ? `Logged ${totalDays} daily care records (${start} → ${end})`
          : "Care logged successfully!"
      );
      onOpenChange(false);
      reset();
      onSuccess();
    }
    setLoading(false);
  };

  const totalCost = (Number(costPerDay) || 0) * (mode === "range"
    ? Math.max(1, Math.floor((new Date(endDate).getTime() - new Date(careDate).getTime()) / 86400000) + 1)
    : 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Care Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Use Template</Label>
              <Select value={selectedTemplate} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="Pick a saved template (optional)" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.duration_days > 1 ? `(${t.duration_days} days)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="single">📅 Single Day</TabsTrigger>
              <TabsTrigger value="range">📆 Date Range</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{mode === "range" ? "Start Date" : "Date"}</Label>
              <Input type="date" value={careDate} onChange={(e) => setCareDate(e.target.value)} />
            </div>
            {mode === "range" && (
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} min={careDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
          </div>

          {mode === "range" && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              📌 This creates one daily record for each day in the range, all linked as one treatment course.
            </p>
          )}

          <div className="space-y-2">
            <Label>Care Type *</Label>
            <Select value={careType} onValueChange={onCareTypeChange}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {CARE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was done..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g., La Sota" />
            </div>
            <div className="space-y-2">
              <Label>Dosage</Label>
              <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g., 1ml per bird" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Animals Affected</Label>
              <Input
                type="number"
                min={0}
                max={batchQuantity}
                value={quantityAffected || ""}
                onChange={(e) => setQuantityAffected(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-warning" /> Withdrawal (days)
              </Label>
              <Input
                type="number"
                min={0}
                value={withdrawalDays}
                onChange={(e) => setWithdrawalDays(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          {withdrawalDays > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              ⚠️ Eggs/meat from this batch should not be sold until {addDays(mode === "range" ? endDate : careDate, withdrawalDays)}
            </Badge>
          )}

          <div className="space-y-2">
            <Label>Cost {mode === "range" ? "per day" : ""} (₦)</Label>
            <Input
              type="number"
              min={0}
              value={costPerDay}
              onChange={(e) => setCostPerDay(e.target.value)}
              placeholder="0"
            />
            {mode === "range" && Number(costPerDay) > 0 && (
              <p className="text-xs text-muted-foreground">Total: ₦{totalCost.toLocaleString()}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional observations..." />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !careType || !description}>
            {loading ? "Saving..." : mode === "range" ? "Log Treatment Course" : "Log Care Record"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCareLogDialog;
