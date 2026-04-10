import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { Stethoscope, Plus, Eye, Skull, CheckCircle2, Clock, Pill, ClipboardList, History, Sparkles, Loader2, AlertTriangle, Shield, Lightbulb } from "lucide-react";

const SEVERITIES = ["mild", "moderate", "severe", "critical"];
const ANIMAL_TYPES = ["Chicken", "Turkey", "Goat", "Cattle", "Sheep", "Pig", "Other"];

interface AISuggestion {
  likely_diagnoses?: { condition: string; confidence: string; explanation: string }[];
  immediate_actions?: { action: string; priority: string; details: string }[];
  medications?: { name: string; dosage: string; frequency: string; duration: string; notes: string }[];
  warning_signs?: string[];
  recovery_timeline?: string;
  prevention_tips?: string[];
  general_advice?: string;
}

export default function FarmClinicTab() {
  const { currentBranchId } = useBranch();
  const queryClient = useQueryClient();
  const [showAdmitDialog, setShowAdmitDialog] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [activeView, setActiveView] = useState("active");

  // Form state
  const [form, setForm] = useState({
    animal_type: "", category: "", age_weeks: 0, condition: "", symptoms: "", severity: "moderate", notes: "",
  });

  // Treatment form
  const [treatmentForm, setTreatmentForm] = useState({ treatment_description: "", medication: "", dosage: "" });
  // Observation form
  const [observationText, setObservationText] = useState("");

  // AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [detailAiSuggestions, setDetailAiSuggestions] = useState<AISuggestion | null>(null);
  const [detailAiLoading, setDetailAiLoading] = useState(false);

  const { data: admissions, isLoading } = useQuery({
    queryKey: ["clinic-admissions", currentBranchId, activeView],
    queryFn: async () => {
      let query = supabase.from("clinic_admissions").select("*").order("created_at", { ascending: false });
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      if (activeView === "active") query = query.eq("status", "admitted");
      else query = query.neq("status", "admitted");
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["livestock-categories-clinic"],
    queryFn: async () => {
      const { data, error } = await supabase.from("livestock_categories").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const { data: treatments } = useQuery({
    queryKey: ["clinic-treatments", selectedAdmission?.id],
    enabled: !!selectedAdmission,
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_treatments")
        .select("*, profiles:administered_by(name)")
        .eq("admission_id", selectedAdmission.id)
        .order("treatment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: observations } = useQuery({
    queryKey: ["clinic-observations", selectedAdmission?.id],
    enabled: !!selectedAdmission,
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_observations")
        .select("*, profiles:observed_by(name)")
        .eq("admission_id", selectedAdmission.id)
        .order("observation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const fetchAiSuggestions = async (params: {
    animal_type: string; category: string; age_weeks: number;
    condition: string; symptoms: string; severity: string;
    treatments?: any[]; observations?: any[];
  }) => {
    const { data, error } = await supabase.functions.invoke("clinic-ai-suggestions", { body: params });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as AISuggestion;
  };

  const handleAdmitAiSuggest = async () => {
    if (!form.animal_type || !form.category) {
      toast.error("Please select animal type and category first");
      return;
    }
    if (!form.condition && !form.symptoms) {
      toast.error("Please enter a condition or symptoms for AI analysis");
      return;
    }
    setAiLoading(true);
    setShowAiPanel(true);
    try {
      const result = await fetchAiSuggestions({
        animal_type: form.animal_type, category: form.category,
        age_weeks: form.age_weeks, condition: form.condition,
        symptoms: form.symptoms, severity: form.severity,
      });
      setAiSuggestions(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to get AI suggestions");
      setShowAiPanel(false);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDetailAiSuggest = async () => {
    if (!selectedAdmission) return;
    setDetailAiLoading(true);
    try {
      const result = await fetchAiSuggestions({
        animal_type: selectedAdmission.animal_type,
        category: selectedAdmission.category,
        age_weeks: selectedAdmission.age_weeks,
        condition: selectedAdmission.condition || "",
        symptoms: selectedAdmission.symptoms || "",
        severity: selectedAdmission.severity,
        treatments: treatments?.map(t => ({
          treatment_description: t.treatment_description,
          medication: t.medication, dosage: t.dosage,
        })),
        observations: observations?.map(o => ({ observation: o.observation })),
      });
      setDetailAiSuggestions(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to get AI suggestions");
    } finally {
      setDetailAiLoading(false);
    }
  };

  const admitMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("clinic_admissions").insert({
        animal_type: form.animal_type, category: form.category,
        age_weeks: form.age_weeks, condition: form.condition || null,
        symptoms: form.symptoms || null, severity: form.severity,
        notes: form.notes || null, branch_id: currentBranchId || null,
        admitted_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Animal admitted to clinic");
      queryClient.invalidateQueries({ queryKey: ["clinic-admissions"] });
      setShowAdmitDialog(false);
      setForm({ animal_type: "", category: "", age_weeks: 0, condition: "", symptoms: "", severity: "moderate", notes: "" });
      setAiSuggestions(null);
      setShowAiPanel(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addTreatmentMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("clinic_treatments").insert({
        admission_id: selectedAdmission.id,
        treatment_description: treatmentForm.treatment_description,
        medication: treatmentForm.medication || null,
        dosage: treatmentForm.dosage || null,
        administered_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treatment logged");
      queryClient.invalidateQueries({ queryKey: ["clinic-treatments"] });
      setTreatmentForm({ treatment_description: "", medication: "", dosage: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addObservationMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("clinic_observations").insert({
        admission_id: selectedAdmission.id,
        observation: observationText,
        observed_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observation logged");
      queryClient.invalidateQueries({ queryKey: ["clinic-observations"] });
      setObservationText("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      const update: any = { status, updated_at: new Date().toISOString() };
      if (status === "discharged") {
        update.discharge_date = new Date().toISOString().split("T")[0];
        update.discharge_notes = notes || null;
      } else if (status === "deceased") {
        update.death_date = new Date().toISOString().split("T")[0];
        update.cause_of_death = notes || null;
      }
      const { error } = await supabase.from("clinic_admissions").update(update).eq("id", selectedAdmission.id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.status === "discharged" ? "Animal discharged successfully!" : "Animal marked as deceased");
      queryClient.invalidateQueries({ queryKey: ["clinic-admissions"] });
      setShowDetailDialog(false);
      setSelectedAdmission(null);
      setDetailAiSuggestions(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [dischargeNotes, setDischargeNotes] = useState("");
  const [showDischargeDialog, setShowDischargeDialog] = useState(false);
  const [showDeathDialog, setShowDeathDialog] = useState(false);
  const [deathCause, setDeathCause] = useState("");

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "severe": return "destructive";
      case "moderate": return "secondary";
      case "mild": return "outline";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "admitted": return <Clock className="h-4 w-4 text-warning" />;
      case "discharged": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "deceased": return <Skull className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "text-destructive font-bold";
      case "high": return "text-orange-600 font-semibold";
      default: return "text-foreground";
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">High</Badge>;
      case "medium": return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Medium</Badge>;
      default: return <Badge variant="outline">Low</Badge>;
    }
  };

  const AiSuggestionsPanel = ({ suggestions, loading }: { suggestions: AISuggestion | null; loading: boolean }) => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">AI is analyzing symptoms...</p>
        </div>
      );
    }
    if (!suggestions) return null;

    return (
      <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Sparkles className="h-5 w-5" />
          AI Veterinary Suggestions
        </div>

        {/* Likely Diagnoses */}
        {suggestions.likely_diagnoses && suggestions.likely_diagnoses.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
              <Stethoscope className="h-4 w-4" /> Likely Diagnoses
            </h4>
            <div className="space-y-2">
              {suggestions.likely_diagnoses.map((d, i) => (
                <div key={i} className="p-2 bg-background rounded border text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.condition}</span>
                    {getConfidenceBadge(d.confidence)}
                  </div>
                  <p className="text-muted-foreground mt-1">{d.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Immediate Actions */}
        {suggestions.immediate_actions && suggestions.immediate_actions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
              <AlertTriangle className="h-4 w-4" /> Immediate Actions
            </h4>
            <div className="space-y-1">
              {suggestions.immediate_actions.map((a, i) => (
                <div key={i} className="p-2 bg-background rounded border text-sm">
                  <span className={getPriorityColor(a.priority)}>
                    [{a.priority.toUpperCase()}] {a.action}
                  </span>
                  <p className="text-muted-foreground">{a.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medications */}
        {suggestions.medications && suggestions.medications.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
              <Pill className="h-4 w-4" /> Recommended Medications
            </h4>
            <div className="space-y-2">
              {suggestions.medications.map((m, i) => (
                <div key={i} className="p-2 bg-background rounded border text-sm">
                  <div className="font-medium">💊 {m.name}</div>
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground text-xs mt-1">
                    <span>Dosage: {m.dosage}</span>
                    <span>Frequency: {m.frequency}</span>
                    <span>Duration: {m.duration}</span>
                  </div>
                  {m.notes && <p className="text-xs text-muted-foreground mt-1 italic">{m.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning Signs */}
        {suggestions.warning_signs && suggestions.warning_signs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
              <Eye className="h-4 w-4" /> Warning Signs to Watch
            </h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {suggestions.warning_signs.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* Recovery Timeline */}
        {suggestions.recovery_timeline && (
          <div className="p-2 bg-background rounded border text-sm">
            <span className="font-medium">⏱ Recovery Timeline:</span>{" "}
            <span className="text-muted-foreground">{suggestions.recovery_timeline}</span>
          </div>
        )}

        {/* Prevention Tips */}
        {suggestions.prevention_tips && suggestions.prevention_tips.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
              <Shield className="h-4 w-4" /> Prevention Tips
            </h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {suggestions.prevention_tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}

        {/* General Advice */}
        {suggestions.general_advice && (
          <div className="p-2 bg-primary/5 rounded border border-primary/20 text-sm flex gap-2">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>{suggestions.general_advice}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            Farm Clinic
          </h2>
          <p className="text-muted-foreground">Admit, treat, and track sick animals</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-base px-3 py-1">
            {activeView === "active" ? `${admissions?.length || 0} Currently Admitted` : `${admissions?.length || 0} History Records`}
          </Badge>
          <Button onClick={() => setShowAdmitDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Admit Animal
          </Button>
        </div>
      </div>

      {/* Toggle Active / History */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Currently Admitted
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Clinic History
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Admission Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : admissions && admissions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {admissions.map((admission) => (
            <Card key={admission.id} className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
              style={{ borderLeftColor: admission.severity === "critical" ? "hsl(var(--destructive))" : admission.severity === "severe" ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}
              onClick={() => { setSelectedAdmission(admission); setShowDetailDialog(true); setDetailAiSuggestions(null); }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{admission.animal_type}</CardTitle>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(admission.status)}
                    <Badge variant={getSeverityColor(admission.severity) as any}>{admission.severity}</Badge>
                  </div>
                </div>
                <CardDescription>{admission.category} • {admission.age_weeks} weeks old</CardDescription>
              </CardHeader>
              <CardContent>
                {admission.condition && <p className="text-sm font-medium mb-1">Condition: {admission.condition}</p>}
                {admission.symptoms && <p className="text-sm text-muted-foreground line-clamp-2">{admission.symptoms}</p>}
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>Admitted: {format(new Date(admission.admission_date), "MMM dd, yyyy")}</span>
                  {admission.discharge_date && <span>Discharged: {format(new Date(admission.discharge_date), "MMM dd")}</span>}
                  {admission.death_date && <span className="text-destructive">Died: {format(new Date(admission.death_date), "MMM dd")}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {activeView === "active" ? "No animals currently admitted" : "No clinic history records"}
          </CardContent>
        </Card>
      )}

      {/* Admit Dialog */}
      <Dialog open={showAdmitDialog} onOpenChange={(open) => { setShowAdmitDialog(open); if (!open) { setAiSuggestions(null); setShowAiPanel(false); } }}>
        <DialogContent className={showAiPanel ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Admit Animal</DialogTitle>
          </DialogHeader>
          <div className={showAiPanel ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
            <div className="space-y-4">
              <div>
                <Label>Animal Type</Label>
                <Select value={form.animal_type} onValueChange={(v) => setForm({ ...form, animal_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{ANIMAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Age (weeks)</Label>
                <Input type="number" min={0} value={form.age_weeks} onChange={(e) => setForm({ ...form, age_weeks: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Condition (if known)</Label>
                <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="e.g. Newcastle Disease" />
              </div>
              <div>
                <Label>Symptoms / Physical Observations</Label>
                <Textarea value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} placeholder="Describe visible symptoms..." />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any extra info..." />
              </div>

              {/* AI Suggestion Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-primary/30 text-primary hover:bg-primary/5"
                onClick={handleAdmitAiSuggest}
                disabled={aiLoading}
              >
                {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {aiLoading ? "Analyzing..." : "Get AI Suggestions"}
              </Button>
            </div>

            {/* AI Panel in Admit Dialog */}
            {showAiPanel && (
              <AiSuggestionsPanel suggestions={aiSuggestions} loading={aiLoading} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdmitDialog(false)}>Cancel</Button>
            <Button onClick={() => admitMutation.mutate()} disabled={!form.animal_type || !form.category || admitMutation.isPending}>
              {admitMutation.isPending ? "Admitting..." : "Admit Animal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => { setShowDetailDialog(open); if (!open) { setSelectedAdmission(null); setDetailAiSuggestions(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAdmission && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  {selectedAdmission.animal_type} — {selectedAdmission.category}
                </DialogTitle>
              </DialogHeader>

              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Age:</span> {selectedAdmission.age_weeks} weeks</div>
                <div><span className="text-muted-foreground">Severity:</span> <Badge variant={getSeverityColor(selectedAdmission.severity) as any}>{selectedAdmission.severity}</Badge></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="flex items-center gap-1 inline-flex">{getStatusIcon(selectedAdmission.status)} {selectedAdmission.status}</span></div>
                <div><span className="text-muted-foreground">Admitted:</span> {format(new Date(selectedAdmission.admission_date), "MMM dd, yyyy")}</div>
                {selectedAdmission.condition && <div className="col-span-2"><span className="text-muted-foreground">Condition:</span> {selectedAdmission.condition}</div>}
                {selectedAdmission.symptoms && <div className="col-span-2"><span className="text-muted-foreground">Symptoms:</span> {selectedAdmission.symptoms}</div>}
                {selectedAdmission.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {selectedAdmission.notes}</div>}
                {selectedAdmission.discharge_notes && <div className="col-span-2"><span className="text-muted-foreground">Discharge Notes:</span> {selectedAdmission.discharge_notes}</div>}
                {selectedAdmission.cause_of_death && <div className="col-span-2"><span className="text-muted-foreground">Cause of Death:</span> {selectedAdmission.cause_of_death}</div>}
              </div>

              {/* AI Suggestions Button for Detail View */}
              <Button
                variant="outline"
                className="w-full border-primary/30 text-primary hover:bg-primary/5"
                onClick={handleDetailAiSuggest}
                disabled={detailAiLoading}
              >
                {detailAiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {detailAiLoading ? "Analyzing with treatment history..." : "Get AI Treatment Suggestions"}
              </Button>

              {/* AI Suggestions in Detail View */}
              {(detailAiSuggestions || detailAiLoading) && (
                <AiSuggestionsPanel suggestions={detailAiSuggestions} loading={detailAiLoading} />
              )}

              {selectedAdmission.status === "admitted" && (
                <>
                  <Separator />

                  {/* Treatment Log */}
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3"><Pill className="h-4 w-4" /> Log Treatment</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Treatment Description</Label>
                        <Textarea value={treatmentForm.treatment_description} onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_description: e.target.value })} placeholder="What was done..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Medication</Label>
                          <Input value={treatmentForm.medication} onChange={(e) => setTreatmentForm({ ...treatmentForm, medication: e.target.value })} placeholder="Drug name" />
                        </div>
                        <div>
                          <Label>Dosage</Label>
                          <Input value={treatmentForm.dosage} onChange={(e) => setTreatmentForm({ ...treatmentForm, dosage: e.target.value })} placeholder="e.g. 2ml" />
                        </div>
                      </div>
                      <Button size="sm" onClick={() => addTreatmentMutation.mutate()} disabled={!treatmentForm.treatment_description || addTreatmentMutation.isPending}>
                        Add Treatment
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Observation Log */}
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3"><ClipboardList className="h-4 w-4" /> Log Observation</h3>
                    <div className="flex gap-2">
                      <Textarea value={observationText} onChange={(e) => setObservationText(e.target.value)} placeholder="What did you observe..." className="flex-1" />
                      <Button size="sm" onClick={() => addObservationMutation.mutate()} disabled={!observationText || addObservationMutation.isPending} className="self-end">
                        Add
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button className="flex-1" variant="default" onClick={() => setShowDischargeDialog(true)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Discharge (Well)
                    </Button>
                    <Button className="flex-1" variant="destructive" onClick={() => setShowDeathDialog(true)}>
                      <Skull className="h-4 w-4 mr-2" /> Mark as Dead
                    </Button>
                  </div>
                </>
              )}

              <Separator />

              {/* Treatment History */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3"><Pill className="h-4 w-4" /> Treatment History</h3>
                {treatments && treatments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {treatments.map((t) => (
                      <div key={t.id} className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{t.treatment_description}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(t.treatment_date), "MMM dd, HH:mm")}</span>
                        </div>
                        {t.medication && <p className="text-muted-foreground">💊 {t.medication} {t.dosage && `— ${t.dosage}`}</p>}
                        <p className="text-xs text-muted-foreground">By: {(t.profiles as any)?.name || "Unknown"}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No treatments logged yet</p>}
              </div>

              {/* Observation History */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3"><Eye className="h-4 w-4" /> Observations</h3>
                {observations && observations.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {observations.map((o) => (
                      <div key={o.id} className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex justify-between">
                          <span>{o.observation}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(o.observation_date), "MMM dd, HH:mm")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">By: {(o.profiles as any)?.name || "Unknown"}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No observations logged yet</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Discharge Confirmation */}
      <Dialog open={showDischargeDialog} onOpenChange={setShowDischargeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Discharge Animal</DialogTitle></DialogHeader>
          <div>
            <Label>Discharge Notes (optional)</Label>
            <Textarea value={dischargeNotes} onChange={(e) => setDischargeNotes(e.target.value)} placeholder="Recovery notes..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDischargeDialog(false)}>Cancel</Button>
            <Button onClick={() => { updateStatusMutation.mutate({ status: "discharged", notes: dischargeNotes }); setShowDischargeDialog(false); setDischargeNotes(""); }}>
              Confirm Discharge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Death Confirmation */}
      <Dialog open={showDeathDialog} onOpenChange={setShowDeathDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Mark Animal as Deceased</DialogTitle></DialogHeader>
          <div>
            <Label>Cause of Death</Label>
            <Textarea value={deathCause} onChange={(e) => setDeathCause(e.target.value)} placeholder="What caused the death..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeathDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { updateStatusMutation.mutate({ status: "deceased", notes: deathCause }); setShowDeathDialog(false); setDeathCause(""); }}>
              Confirm Death
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
