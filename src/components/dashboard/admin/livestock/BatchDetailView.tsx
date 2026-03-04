import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Sparkles, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AddCareLogDialog from "./AddCareLogDialog";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

interface Props {
  batch: any;
  onBack: () => void;
}

const CARE_TYPE_COLORS: Record<string, string> = {
  vaccination: "bg-blue-500",
  medication: "bg-red-500",
  feeding: "bg-green-500",
  supplement: "bg-yellow-500",
  deworming: "bg-purple-500",
  vitamin: "bg-orange-500",
  observation: "bg-muted-foreground",
  other: "bg-muted-foreground",
};

const BatchDetailView = ({ batch, onBack }: Props) => {
  const [careLogs, setCareLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showAddCare, setShowAddCare] = useState(false);
  const [batchData, setBatchData] = useState(batch);

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: careLogs.length,
    itemsPerPage: 10,
  });

  const paginatedItems = careLogs.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  const fetchCareLogs = async () => {
    const { data } = await supabase
      .from("livestock_care_logs")
      .select("*, profiles:administered_by(name)")
      .eq("batch_id", batch.id)
      .order("care_date", { ascending: false });
    setCareLogs(data || []);
  };

  const fetchTemplates = async () => {
    let query = supabase
      .from("livestock_care_templates")
      .select("*")
      .eq("species", batch.species)
      .order("week_number")
      .order("sort_order");

    if (batch.species_type) query = query.eq("species_type", batch.species_type);

    const { data } = await query;
    setTemplates(data || []);
  };

  useEffect(() => {
    fetchCareLogs();
    fetchTemplates();
  }, [batch.id]);

  const getAiSuggestions = async () => {
    setLoadingAi(true);
    try {
      const recentCare = careLogs.slice(0, 5).map((l) => `${l.care_date}: ${l.care_type} - ${l.description}`).join("; ");
      
      const { data, error } = await supabase.functions.invoke("livestock-care-suggestions", {
        body: {
          species: batch.species,
          speciesType: batch.species_type,
          stage: batch.stage,
          ageWeeks: batch.age_weeks,
          source: batch.source,
          currentCareHistory: recentCare || "No care recorded yet",
        },
      });

      if (error) throw error;
      setAiSuggestions(data);
    } catch (e: any) {
      toast.error("Failed to get AI suggestions: " + (e.message || "Unknown error"));
    }
    setLoadingAi(false);
  };

  const updateBatch = async (updates: Record<string, any>) => {
    const { error } = await supabase
      .from("livestock_batches")
      .update(updates)
      .eq("id", batch.id);
    if (error) {
      toast.error("Failed to update batch");
    } else {
      setBatchData({ ...batchData, ...updates });
      toast.success("Batch updated");
    }
  };

  const markAsLaying = () => {
    updateBatch({
      has_started_laying: true,
      laying_start_date: new Date().toISOString().split("T")[0],
      stage: "laying",
    });
  };

  const upcomingTemplates = templates.filter((t) => t.week_number >= (batchData.age_weeks || 0));
  const completedTemplates = templates.filter((t) => t.week_number < (batchData.age_weeks || 0));
  const currentWeekTemplates = templates.filter((t) => t.week_number === (batchData.age_weeks || 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold capitalize">
            {batchData.species_type || batchData.species} Batch
          </h2>
          <p className="text-sm text-muted-foreground">
            {batchData.current_quantity} animals • {batchData.age_weeks} weeks old • Stage: {batchData.stage?.replace(/_/g, " ")}
          </p>
        </div>
        {batchData.species === "chicken" && batchData.species_type === "layer" && !batchData.has_started_laying && (
          <Button size="sm" variant="outline" onClick={markAsLaying}>
            🥚 Mark as Laying
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{batchData.current_quantity}</p><p className="text-xs text-muted-foreground">Current Count</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{batchData.age_weeks} wks</p><p className="text-xs text-muted-foreground">Age</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{careLogs.length}</p><p className="text-xs text-muted-foreground">Care Records</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{currentWeekTemplates.length}</p><p className="text-xs text-muted-foreground">Due This Week</p></CardContent></Card>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="schedule" className="text-xs">📋 Care Schedule</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">📝 Care Logs</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">✨ AI Suggestions</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">ℹ️ Details</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-3">
          {currentWeekTemplates.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Due This Week (Week {batchData.age_weeks})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentWeekTemplates.map((t: any) => (
                  <div key={t.id} className="flex items-start gap-3 p-2 rounded bg-background">
                    <Badge className={`${CARE_TYPE_COLORS[t.care_type]} text-white text-xs`}>{t.care_type}</Badge>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      {t.product_name && <p className="text-xs mt-1">💊 {t.product_name} {t.dosage ? `• ${t.dosage}` : ""}</p>}
                    </div>
                    {t.is_critical && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <h3 className="font-semibold text-sm">Upcoming Schedule</h3>
          {upcomingTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No more scheduled tasks</p>
          ) : (
            <div className="space-y-2">
              {upcomingTemplates.slice(0, 15).map((t: any) => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded border">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs text-muted-foreground">Week</p>
                    <p className="font-bold">{t.week_number}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`${CARE_TYPE_COLORS[t.care_type]} text-white text-xs`}>{t.care_type}</Badge>
                      <p className="font-medium text-sm">{t.title}</p>
                      {t.is_critical && <Badge variant="destructive" className="text-xs">!</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    {t.product_name && <p className="text-xs mt-1 text-primary">💊 {t.product_name} {t.dosage ? `• ${t.dosage}` : ""}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {completedTemplates.length > 0 && (
            <>
              <h3 className="font-semibold text-sm mt-4 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" /> Past Schedule ({completedTemplates.length})
              </h3>
              <div className="space-y-1 opacity-60">
                {completedTemplates.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                    <span className="text-xs min-w-[40px]">Wk {t.week_number}</span>
                    <CheckCircle className="h-3 w-3 text-primary" />
                    <span>{t.title}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Care History</h3>
            <Button size="sm" onClick={() => setShowAddCare(true)}>
              <Plus className="h-4 w-4 mr-1" /> Log Care
            </Button>
          </div>

          {paginatedItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No care records yet. Start logging daily care!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {paginatedItems.map((log: any) => (
                <Card key={log.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Badge className={`${CARE_TYPE_COLORS[log.care_type]} text-white text-xs`}>{log.care_type}</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{log.description}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          <span>📅 {new Date(log.care_date).toLocaleDateString()}</span>
                          {log.product_name && <span>💊 {log.product_name}</span>}
                          {log.dosage && <span>📏 {log.dosage}</span>}
                          {log.quantity_affected && <span>🐾 {log.quantity_affected} animals</span>}
                          {log.profiles?.name && <span>👤 {log.profiles.name}</span>}
                        </div>
                        {log.notes && <p className="text-xs mt-1 italic">{log.notes}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} getPageNumbers={getPageNumbers} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">AI Care Recommendations</h3>
            <Button size="sm" onClick={getAiSuggestions} disabled={loadingAi}>
              {loadingAi ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {loadingAi ? "Analyzing..." : "Get Suggestions"}
            </Button>
          </div>

          {!aiSuggestions && !loadingAi && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p>Click "Get Suggestions" for AI-powered care recommendations</p>
                <p className="text-xs mt-1">Based on Nigerian livestock farming best practices</p>
              </CardContent>
            </Card>
          )}

          {aiSuggestions && (
            <div className="space-y-3">
              {aiSuggestions.general_tip && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-primary mb-1">💡 Tip</p>
                    <p className="text-sm">{aiSuggestions.general_tip}</p>
                  </CardContent>
                </Card>
              )}

              {aiSuggestions.next_milestone && (
                <Card className="bg-accent/50 border-accent">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-accent-foreground mb-1">🎯 Next Milestone</p>
                    <p className="text-sm">{aiSuggestions.next_milestone}</p>
                  </CardContent>
                </Card>
              )}

              {aiSuggestions.recommendations?.map((rec: any, i: number) => (
                <Card key={i} className={rec.urgency === "critical" ? "border-destructive/50" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge
                        variant={rec.urgency === "critical" ? "destructive" : rec.urgency === "recommended" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {rec.urgency}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                        {rec.product_name && <p className="text-xs mt-1">💊 {rec.product_name} {rec.dosage ? `• ${rec.dosage}` : ""}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Species</p><p className="font-medium capitalize">{batchData.species}</p></div>
                <div><p className="text-muted-foreground text-xs">Type</p><p className="font-medium capitalize">{batchData.species_type?.replace(/_/g, " ") || "N/A"}</p></div>
                <div><p className="text-muted-foreground text-xs">Stage</p><p className="font-medium capitalize">{batchData.stage?.replace(/_/g, " ")}</p></div>
                <div><p className="text-muted-foreground text-xs">Age</p><p className="font-medium">{batchData.age_weeks} weeks</p></div>
                <div><p className="text-muted-foreground text-xs">Initial Quantity</p><p className="font-medium">{batchData.quantity}</p></div>
                <div><p className="text-muted-foreground text-xs">Current Quantity</p><p className="font-medium">{batchData.current_quantity}</p></div>
                <div><p className="text-muted-foreground text-xs">Cost per Unit</p><p className="font-medium">₦{batchData.cost_per_unit?.toLocaleString() || 0}</p></div>
                <div><p className="text-muted-foreground text-xs">Total Cost</p><p className="font-medium">₦{batchData.total_cost?.toLocaleString() || 0}</p></div>
                <div><p className="text-muted-foreground text-xs">Source</p><p className="font-medium">{batchData.source || "N/A"}</p></div>
                <div><p className="text-muted-foreground text-xs">Date Acquired</p><p className="font-medium">{new Date(batchData.date_acquired).toLocaleDateString()}</p></div>
              </div>
              {batchData.notes && (
                <div><p className="text-muted-foreground text-xs">Notes</p><p className="text-sm">{batchData.notes}</p></div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => updateBatch({ age_weeks: (batchData.age_weeks || 0) + 1 })}>
                  <Clock className="h-3 w-3 mr-1" /> +1 Week Age
                </Button>
                <Button size="sm" variant={batchData.is_active ? "destructive" : "default"} onClick={() => updateBatch({ is_active: !batchData.is_active })}>
                  {batchData.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddCareLogDialog
        open={showAddCare}
        onOpenChange={setShowAddCare}
        batchId={batch.id}
        branchId={batch.branch_id}
        batchQuantity={batchData.current_quantity}
        onSuccess={fetchCareLogs}
      />
    </div>
  );
};

export default BatchDetailView;
