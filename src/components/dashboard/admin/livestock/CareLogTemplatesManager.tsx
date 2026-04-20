import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BookTemplate } from "lucide-react";
import { toast } from "sonner";

const CARE_TYPES = ["vaccination", "medication", "antibiotics", "feeding", "supplement", "deworming", "observation", "other"];

const CareLogTemplatesManager = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    care_type: "",
    description: "",
    product_name: "",
    dosage: "",
    duration_days: 1,
    withdrawal_days: 0,
    default_cost: 0,
    notes: "",
  });

  const fetch = async () => {
    const { data } = await supabase.from("care_log_templates").select("*").order("name");
    setTemplates(data || []);
  };

  useEffect(() => { fetch(); }, []);

  const save = async () => {
    if (!form.name || !form.care_type) {
      toast.error("Name and care type are required");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("care_log_templates").insert({
      ...form,
      created_by: user.id,
    });
    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }
    toast.success("Template saved");
    setOpen(false);
    setForm({ name: "", care_type: "", description: "", product_name: "", dosage: "", duration_days: 1, withdrawal_days: 0, default_cost: 0, notes: "" });
    fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("care_log_templates").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Deleted"); fetch(); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookTemplate className="h-5 w-5 text-primary" /> Care Log Templates
            </CardTitle>
            <CardDescription>Reusable care protocols for one-click logging</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Care Template</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Template Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Newcastle Vaccine Protocol" /></div>
                <div>
                  <Label>Care Type *</Label>
                  <Select value={form.care_type} onValueChange={(v) => setForm({ ...form, care_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{CARE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Product</Label><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
                  <div><Label>Dosage</Label><Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Duration (days)</Label><Input type="number" min={1} value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) || 1 })} /></div>
                  <div><Label>Withdrawal (days)</Label><Input type="number" min={0} value={form.withdrawal_days} onChange={(e) => setForm({ ...form, withdrawal_days: parseInt(e.target.value) || 0 })} /></div>
                  <div><Label>Cost/day (₦)</Label><Input type="number" min={0} value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={save} className="w-full">Save Template</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No templates yet. Create one to speed up care logging.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-start justify-between p-3 rounded border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{t.name}</p>
                    <Badge variant="outline" className="text-xs">{t.care_type}</Badge>
                    {t.duration_days > 1 && <Badge variant="secondary" className="text-xs">{t.duration_days} days</Badge>}
                    {t.withdrawal_days > 0 && <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">Withdrawal {t.withdrawal_days}d</Badge>}
                  </div>
                  {t.product_name && <p className="text-xs text-muted-foreground mt-1">💊 {t.product_name} {t.dosage && `• ${t.dosage}`}</p>}
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CareLogTemplatesManager;
