import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Sparkles, CheckCircle, Clock, AlertTriangle, Loader2, DollarSign, Skull, TrendingDown, Handshake, Wallet } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import AddCareLogDialog from "./AddCareLogDialog";
import CareLogsView from "./CareLogsView";
import TreatmentCoursesWidget from "./TreatmentCoursesWidget";
import CareCostAnalytics from "./CareCostAnalytics";
import WithdrawalWarning from "./WithdrawalWarning";
import BatchPnLBreakdown from "./BatchPnLBreakdown";
import PartnerProfitShareWidget from "./PartnerProfitShareWidget";
import ActivityTimeline from "./ActivityTimeline";
import BatchFinancialsCard from "./BatchFinancialsCard";
import BatchSalesTab from "./BatchSalesTab";
import BatchFcrTab from "./BatchFcrTab";
import BatchProjectionCard from "./BatchProjectionCard";
import BatchAnalyticsCharts from "./BatchAnalyticsCharts";
import BatchEggProductionTab from "./BatchEggProductionTab";
import AdjustBirdCountDialog from "./AdjustBirdCountDialog";
import MortalityPhotoPicker from "@/components/dashboard/shared/MortalityPhotoPicker";
import { UploadedMortalityPhoto } from "@/lib/photoUpload";

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
  const [partnerLink, setPartnerLink] = useState<any | null>(null);
  const [availabilityEvents, setAvailabilityEvents] = useState<any[]>([]);
  const [showConfirmAvailable, setShowConfirmAvailable] = useState(false);
  const [confirmingAvailable, setConfirmingAvailable] = useState(false);

  // Expenses state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseType, setExpenseType] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [addingExpense, setAddingExpense] = useState(false);

  // Mortality state
  const [mortalityRecords, setMortalityRecords] = useState<any[]>([]);
  const [showAddMortality, setShowAddMortality] = useState(false);
  const [mortalityQuantity, setMortalityQuantity] = useState("");
  const [mortalityReason, setMortalityReason] = useState("");
  const [mortalityDate, setMortalityDate] = useState(new Date().toISOString().split("T")[0]);
  const [mortalityPhotos, setMortalityPhotos] = useState<UploadedMortalityPhoto[]>([]);
  const [addingMortality, setAddingMortality] = useState(false);

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

  const fetchExpenses = async () => {
    const { data } = await supabase
      .from("miscellaneous_expenses")
      .select("*, profiles:created_by(name)")
      .eq("batch_id", batch.id)
      .order("date", { ascending: false });
    setExpenses(data || []);
  };

  const fetchMortality = async () => {
    const { data } = await supabase
      .from("mortality_records")
      .select("*, profiles:recorded_by(name), livestock_categories(name)")
      .eq("batch_id", batch.id)
      .order("date", { ascending: false });
    setMortalityRecords(data || []);
  };

  const refreshBatch = async () => {
    const { data } = await supabase
      .from("livestock_batches")
      .select("*")
      .eq("id", batch.id)
      .single();
    if (data) setBatchData(data);
  };

  const fetchAvailabilityEvents = async () => {
    const { data } = await supabase
      .from("batch_availability_events" as any)
      .select("*, profiles:changed_by(name)")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: false });
    setAvailabilityEvents((data as any[]) || []);
  };

  useEffect(() => {
    fetchCareLogs();
    fetchTemplates();
    fetchExpenses();
    fetchMortality();
    fetchAvailabilityEvents();
    supabase
      .from("partner_batches")
      .select("*, partners(id, phone, notes, profile_id, profiles!partners_profile_id_fkey(name, email))")
      .eq("batch_id", batch.id)
      .maybeSingle()
      .then(({ data }) => setPartnerLink(data));
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setIsAdmin(false);
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setIsAdmin(data?.role === "admin");
    })();
  }, [batch.id]);


  // Budget threshold alerts (fire once per level per view)
  const [budgetAlertLevel, setBudgetAlertLevel] = useState<0 | 80 | 100>(0);
  useEffect(() => {
    const budget = Number(batchData.budget || 0);
    if (budget <= 0) return;
    const spent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const pct = (spent / budget) * 100;
    if (pct >= 100 && budgetAlertLevel < 100) {
      toast.error(`⚠️ Batch is OVER budget (₦${(spent - budget).toLocaleString()} over)`, { duration: 6000 });
      setBudgetAlertLevel(100);
    } else if (pct >= 80 && budgetAlertLevel < 80) {
      toast.warning(`Batch has used ${pct.toFixed(0)}% of budget`, { duration: 5000 });
      setBudgetAlertLevel(80);
    }
  }, [expenses, batchData.budget, budgetAlertLevel]);

  // Weekly FCR reminder — prompt whenever the last feeding check is 7+ days old
  const [activeTab, setActiveTab] = useState("schedule");
  const [showAdjustCount, setShowAdjustCount] = useState(false);
  const [fcrDue, setFcrDue] = useState(false);
  const [fcrLastDate, setFcrLastDate] = useState<string | null>(null);
  const checkFcrDue = async () => {
    const { data } = await supabase
      .from("batch_fcr_records" as any)
      .select("record_date")
      .eq("batch_id", batch.id)
      .order("record_date", { ascending: false })
      .limit(1);
    const lastDate = (data as any[])?.[0]?.record_date || null;
    setFcrLastDate(lastDate);
    if (!lastDate) {
      setFcrDue(Boolean(batchData.is_active) && (batchData.age_weeks || 0) >= 1);
    } else {
      const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
      setFcrDue(Boolean(batchData.is_active) && days >= 7);
    }
  };
  useEffect(() => { checkFcrDue(); }, [batch.id, batchData.age_weeks, batchData.is_active]);


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

  // Handle add expense
  const handleAddExpense = async () => {
    if (!expenseType || !expenseAmount) return;
    setAddingExpense(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setAddingExpense(false); return; }

    const { error } = await supabase.from("miscellaneous_expenses").insert({
      expense_type: expenseType,
      amount: Number(expenseAmount),
      description: expenseDescription || `${batchData.species_type || batchData.species} batch expense`,
      created_by: user.id,
      date: expenseDate,
      branch_id: batch.branch_id,
      batch_id: batch.id,
    });

    if (error) { toast.error("Failed to add expense"); }
    else {
      toast.success("Expense recorded");
      setShowAddExpense(false);
      setExpenseType("");
      setExpenseAmount("");
      setExpenseDescription("");
      fetchExpenses();
    }
    setAddingExpense(false);
  };

  // Handle add mortality
  const handleAddMortality = async () => {
    if (!mortalityQuantity || !mortalityReason) {
      toast.error("Please fill in quantity and reason (reason is required)");
      return;
    }
    if (mortalityPhotos.length === 0) {
      toast.error("At least one photo of the dead animal is required.");
      return;
    }
    // Category is auto-attached by DB trigger; no manual check required.
    const qty = Number(mortalityQuantity);
    if (qty <= 0 || qty > batchData.current_quantity) {
      toast.error(`Quantity must be between 1 and ${batchData.current_quantity}`);
      return;
    }
    setAddingMortality(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setAddingMortality(false); return; }

    // Ensure a livestock_category_id is available (DB trigger creates one on batch insert/update,
    // but stale local state may still be null). Fetch the freshest value first.
    let categoryId = batchData.livestock_category_id as string | null;
    if (!categoryId) {
      const { data: fresh } = await supabase
        .from("livestock_batches")
        .select("livestock_category_id")
        .eq("id", batch.id)
        .single();
      categoryId = fresh?.livestock_category_id || null;
    }
    if (!categoryId) {
      toast.error("Could not resolve a livestock category for this batch. Try editing the batch and saving again.");
      setAddingMortality(false);
      return;
    }

    const { error } = await supabase.from("mortality_records").insert({
      livestock_category_id: categoryId,
      batch_id: batch.id,
      quantity_dead: qty,
      reason: mortalityReason,
      date: mortalityDate,
      recorded_by: user.id,
      branch_id: batch.branch_id,
      photo_url: mortalityPhotos[0].url,
      photo_urls: mortalityPhotos.map((p) => p.url),
      photo_hashes: mortalityPhotos.map((p) => p.hash),
    });

    if (error) { toast.error("Failed to record mortality: " + error.message); }
    else {
      toast.success(`${qty} mortality recorded. Batch quantity updated.`);
      setShowAddMortality(false);
      setMortalityQuantity("");
      setMortalityReason("");
      setMortalityPhotos([]);
      fetchMortality();
      refreshBatch();
    }
    setAddingMortality(false);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalMortality = mortalityRecords.reduce((sum, m) => sum + Number(m.quantity_dead), 0);
  const purchaseCost = Number(batchData.total_cost || 0);
  const totalInvestment = purchaseCost + totalExpenses;

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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAdjustCount(true)}>
            Adjust {batchData.species === "chicken" ? "bird" : "animal"} count
          </Button>
          {batchData.species === "chicken" && batchData.species_type === "layer" && !batchData.has_started_laying && (
            <Button size="sm" variant="outline" onClick={markAsLaying}>
              🥚 Mark as Laying
            </Button>
          )}
        </div>
      </div>

      <AdjustBirdCountDialog
        open={showAdjustCount}
        onOpenChange={setShowAdjustCount}
        batch={batchData}
        noun={batchData.species === "chicken" ? "birds" : "animals"}
        onSaved={refreshBatch}
      />


      {batchData.availability_status === "pending" && (() => {
        const overdue = batchData.expected_arrival_date && new Date(batchData.expected_arrival_date) < new Date(new Date().toDateString());
        const daysLate = overdue
          ? Math.floor((Date.now() - new Date(batchData.expected_arrival_date).getTime()) / 864e5)
          : 0;
        return (
          <Card className={overdue ? "border-destructive/60 bg-destructive/5" : "border-amber-500/50 bg-amber-500/5"}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={overdue ? "border-destructive text-destructive" : "border-amber-500 text-amber-700 dark:text-amber-400"}>
                      {overdue ? `⏰ Overdue ${daysLate}d` : "Stock Pending"}
                    </Badge>
                    <p className="font-semibold text-sm">
                      {overdue ? "Expected stock has not arrived yet" : "Awaiting stock arrival"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Age is frozen at 0 until you confirm the stock is on hand.
                    {batchData.expected_source && <> Expected from <b>{batchData.expected_source}</b>.</>}
                    {batchData.expected_arrival_date && <> Due <b>{new Date(batchData.expected_arrival_date).toLocaleDateString()}</b>.</>}
                    {batchData.expected_cost_per_unit && <> Est. ₦{Number(batchData.expected_cost_per_unit).toLocaleString()}/unit.</>}
                  </p>
                </div>
                <Button size="sm" onClick={() => setShowConfirmAvailable(true)}>
                  ✅ Mark Stock Available
                </Button>
              </div>
              <div className="rounded-md border bg-background/60 p-2 text-[11px] text-muted-foreground leading-relaxed">
                <b>How to use:</b> when the animals physically arrive on the farm, click <b>Mark Stock Available</b>.
                We'll copy the expected source and cost as the batch's actual values, set the acquisition date to today,
                and start counting age. This action is audit-logged.
                {partnerLink ? " Both admins and the linked partner can confirm arrival." : ""}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Confirm-available dialog */}
      <Dialog open={showConfirmAvailable} onOpenChange={setShowConfirmAvailable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm stock arrival</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              You're confirming that the animals for this batch have physically arrived. We'll apply these values:
            </p>
            <div className="rounded-md border p-3 space-y-1 bg-muted/40">
              <div className="flex justify-between"><span className="text-muted-foreground">Expected quantity</span><b>{batchData.quantity}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Source</span><b>{batchData.expected_source || batchData.source || "—"}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cost / unit</span><b>{(batchData.expected_cost_per_unit || batchData.cost_per_unit) ? "₦" + Number(batchData.expected_cost_per_unit || batchData.cost_per_unit).toLocaleString() : "—"}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Acquisition date</span><b>{new Date().toLocaleDateString()}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Age reset to</span><b>0 weeks</b></div>
            </div>
            <p className="text-xs text-muted-foreground">
              After confirming, an admin can still edit exact figures from the batch edit dialog if the actuals differ from the expected values.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmAvailable(false)} disabled={confirmingAvailable}>Cancel</Button>
            <Button
              disabled={confirmingAvailable}
              onClick={async () => {
                setConfirmingAvailable(true);
                const { error } = await (supabase as any).rpc("confirm_stock_available", { _batch_id: batch.id });
                if (error) toast.error(error.message || "Failed to confirm");
                else {
                  toast.success("Stock marked available — age counting started");
                  setShowConfirmAvailable(false);
                  refreshBatch();
                  fetchAvailabilityEvents();
                }
                setConfirmingAvailable(false);
              }}
            >
              {confirmingAvailable ? "Confirming..." : "Yes, stock has arrived"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WithdrawalWarning logs={careLogs} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{batchData.current_quantity}</p><p className="text-xs text-muted-foreground">Current Count</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{batchData.age_weeks} wks</p><p className="text-xs text-muted-foreground">Age</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-destructive">{totalMortality}</p><p className="text-xs text-muted-foreground">Deaths</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">₦{totalInvestment.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Spent</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{currentWeekTemplates.length}</p><p className="text-xs text-muted-foreground">Due This Week</p></CardContent></Card>
      </div>

      {/* Budget widget */}
      {Number(batchData.budget || 0) > 0 && (() => {
        const budget = Number(batchData.budget || 0);
        const spent = totalExpenses; // Only "other expenses" consume budget (purchase cost separate)
        const remaining = budget - spent;
        const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
        const over = remaining < 0;
        return (
          <Card className={over ? "border-destructive/50 bg-destructive/5" : "border-primary/30 bg-primary/5"}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className={`h-4 w-4 ${over ? "text-destructive" : "text-primary"}`} />
                  <p className="font-semibold text-sm">Batch Budget</p>
                </div>
                <Badge variant={over ? "destructive" : "secondary"} className="text-xs">
                  {pct.toFixed(0)}% used
                </Badge>
              </div>
              <Progress value={Math.min(100, pct)} className={over ? "bg-destructive/20" : ""} />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Spent: ₦{spent.toLocaleString()}</span>
                <span className="text-muted-foreground">Budget: ₦{budget.toLocaleString()}</span>
                <span className={`font-semibold ${over ? "text-destructive" : "text-primary"}`}>
                  {over ? `Over by ₦${Math.abs(remaining).toLocaleString()}` : `Remaining: ₦${remaining.toLocaleString()}`}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Partner details */}
      {partnerLink && partnerLink.partners && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Handshake className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{partnerLink.partners.profiles?.name}</p>
                  <Badge variant="secondary" className="text-xs">Investment Partner</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{partnerLink.partners.profiles?.email}</p>
                {partnerLink.partners.phone && (
                  <p className="text-xs text-muted-foreground">📞 {partnerLink.partners.phone}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">Ownership: {partnerLink.share_percentage}%</Badge>
                  <Badge variant="outline" className="text-xs">Profit Share: {partnerLink.profit_share_percentage ?? partnerLink.share_percentage}%</Badge>
                  <Badge variant="outline" className="text-xs">Invested: ₦{Number(partnerLink.investment_amount).toLocaleString()}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profit Share Summary (partnered batches only) */}
      {partnerLink && (
        <PartnerProfitShareWidget
          partnerLink={partnerLink}
          totalRevenue={0}
          totalCost={totalInvestment}
        />
      )}

      <BatchFinancialsCard batchId={batch.id} />
      <BatchProjectionCard batchId={batch.id} batch={batchData} isAdmin={true} />

      {fcrDue && activeTab !== "fcr" && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs">
              <b>Weekly feeding check due.</b>{" "}
              {fcrLastDate ? `Last FCR entry was ${fcrLastDate}.` : "No FCR entry recorded for this batch yet."}{" "}
              Record sample weights and feed used to keep FCR tracking accurate.
            </p>
            <Button size="sm" onClick={() => setActiveTab("fcr")}>Record FCR now</Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>

        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="schedule" className="text-xs">📋 Schedule</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">📝 Care Logs</TabsTrigger>
          <TabsTrigger value="mortality" className="text-xs">💀 Mortality ({totalMortality})</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs">💰 Expenses</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs">💵 Sales</TabsTrigger>
          <TabsTrigger value="fcr" className="text-xs">⚖️ FCR & Feeding</TabsTrigger>
          {batchData.species === "chicken" && batchData.species_type === "layer" && (
            <TabsTrigger value="eggs" className="text-xs">🥚 Egg Production</TabsTrigger>
          )}
          <TabsTrigger value="analytics" className="text-xs">📊 Analytics</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">🕘 Timeline</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">✨ AI</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">ℹ️ Details</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="space-y-3">
          <BatchSalesTab batch={batchData} onChange={refreshBatch} />
        </TabsContent>
        <TabsContent value="fcr" className="space-y-3">
          <BatchFcrTab batch={batchData} onSaved={() => { refreshBatch(); checkFcrDue(); }} />
        </TabsContent>
        <TabsContent value="analytics" className="space-y-3"><BatchAnalyticsCharts batchId={batch.id} /></TabsContent>
        {batchData.species === "chicken" && batchData.species_type === "layer" && (
          <TabsContent value="eggs" className="space-y-3">
            <BatchEggProductionTab batch={batchData} onBatchUpdated={refreshBatch} />
          </TabsContent>
        )}


        {/* ===== CARE SCHEDULE TAB ===== */}
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

        {/* ===== CARE LOGS TAB ===== */}
        <TabsContent value="logs" className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Care History</h3>
            <Button size="sm" onClick={() => setShowAddCare(true)}>
              <Plus className="h-4 w-4 mr-1" /> Log Care
            </Button>
          </div>

          <TreatmentCoursesWidget logs={careLogs} />
          <BatchPnLBreakdown batch={batchData} careLogs={careLogs} expenses={expenses} />
          <CareCostAnalytics logs={careLogs} currentQuantity={batchData.current_quantity} />
          <CareLogsView logs={careLogs} />
        </TabsContent>

        {/* ===== MORTALITY TAB ===== */}
        <TabsContent value="mortality" className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Mortality Records</h3>
            <Button size="sm" variant="destructive" onClick={() => setShowAddMortality(true)}>
              <Skull className="h-4 w-4 mr-1" /> Record Mortality
            </Button>
          </div>

          {/* Mortality summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-destructive/20">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-destructive">{totalMortality}</p>
                <p className="text-xs text-muted-foreground">Total Deaths</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold">{batchData.quantity}</p>
                <p className="text-xs text-muted-foreground">Initial Count</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-primary">{batchData.current_quantity}</p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </CardContent>
            </Card>
          </div>

          {mortalityRecords.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Skull className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No mortality recorded for this batch</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="hidden sm:table-cell">Recorded By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mortalityRecords.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{new Date(m.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">{m.quantity_dead}</TableCell>
                        <TableCell className="text-sm">{m.reason}</TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{m.profiles?.name || "Unknown"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== EXPENSES TAB ===== */}
        <TabsContent value="expenses" className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Batch Expenses</h3>
            <Button size="sm" onClick={() => setShowAddExpense(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Expense
            </Button>
          </div>

          {/* Expense summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold">₦{purchaseCost.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Purchase Cost</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-amber-600">₦{totalExpenses.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Other Expenses</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold">₦{totalInvestment.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Investment</p>
              </CardContent>
            </Card>
          </div>

          {/* Cost per bird */}
          {batchData.current_quantity > 0 && (
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cost per animal (alive)</span>
                <span className="font-bold text-primary">
                  ₦{Math.round(totalInvestment / batchData.current_quantity).toLocaleString()}
                </span>
              </CardContent>
            </Card>
          )}

          {expenses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No additional expenses recorded yet</p>
                <p className="text-xs mt-1">Record feed costs, medications, veterinary visits, etc.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden sm:table-cell">Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{new Date(e.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{e.expense_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell max-w-[200px] truncate">
                          {e.description || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">₦{Number(e.amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== ACTIVITY TIMELINE TAB ===== */}
        <TabsContent value="timeline" className="space-y-3">
          <h3 className="font-semibold text-sm">Activity Timeline</h3>
          <p className="text-xs text-muted-foreground">Every care, mortality and expense entry on this batch — filter by type.</p>
          <ActivityTimeline careLogs={careLogs} mortalityRecords={mortalityRecords} expenses={expenses} availabilityEvents={availabilityEvents} />
        </TabsContent>

        {/* ===== AI TAB ===== */}
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

        {/* ===== INFO TAB ===== */}
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

      {/* Add Care Log Dialog */}
      <AddCareLogDialog
        open={showAddCare}
        onOpenChange={setShowAddCare}
        batchId={batch.id}
        branchId={batch.branch_id}
        batchQuantity={batchData.current_quantity}
        onSuccess={fetchCareLogs}
      />

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Record Batch Expense
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Expense Type</Label>
              <Select value={expenseType} onValueChange={setExpenseType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Feed">Feed</SelectItem>
                  <SelectItem value="Medication">Medication</SelectItem>
                  <SelectItem value="Vaccination">Vaccination</SelectItem>
                  <SelectItem value="Veterinary">Veterinary Visit</SelectItem>
                  <SelectItem value="Housing">Housing/Equipment</SelectItem>
                  <SelectItem value="Labor">Labor</SelectItem>
                  <SelectItem value="Transport">Transport</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₦)</Label>
              <Input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="e.g. 5000" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="Details about this expense..." />
            </div>
            <Button onClick={handleAddExpense} disabled={addingExpense || !expenseType || !expenseAmount} className="w-full">
              {addingExpense ? "Recording..." : "Record Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Mortality Dialog */}
      <Dialog open={showAddMortality} onOpenChange={setShowAddMortality}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Skull className="h-5 w-5" /> Record Mortality
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current batch count</span>
                  <span className="font-bold">{batchData.current_quantity}</span>
                </div>
              </CardContent>
            </Card>
            <div>
              <Label>Number of Deaths <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="1"
                max={batchData.current_quantity}
                value={mortalityQuantity}
                onChange={(e) => setMortalityQuantity(e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <Label>Reason for Death <span className="text-destructive">*</span></Label>
              <Select value={mortalityReason} onValueChange={setMortalityReason}>
                <SelectTrigger><SelectValue placeholder="Select reason (required)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Disease">Disease</SelectItem>
                  <SelectItem value="Heat Stress">Heat Stress</SelectItem>
                  <SelectItem value="Cold Stress">Cold Stress</SelectItem>
                  <SelectItem value="Predator Attack">Predator Attack</SelectItem>
                  <SelectItem value="Suffocation">Suffocation/Stampede</SelectItem>
                  <SelectItem value="Poisoning">Poisoning</SelectItem>
                  <SelectItem value="Dehydration">Dehydration</SelectItem>
                  <SelectItem value="Injury">Injury</SelectItem>
                  <SelectItem value="Old Age">Old Age</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={mortalityDate} onChange={(e) => setMortalityDate(e.target.value)} />
            </div>
            <MortalityPhotoPicker value={mortalityPhotos} onChange={setMortalityPhotos} idSuffix="batch" />
            <Button
              onClick={handleAddMortality}
              disabled={addingMortality || !mortalityQuantity || !mortalityReason || mortalityPhotos.length === 0}
              variant="destructive"
              className="w-full"
            >
              {addingMortality ? "Recording..." : "Record Mortality"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchDetailView;
