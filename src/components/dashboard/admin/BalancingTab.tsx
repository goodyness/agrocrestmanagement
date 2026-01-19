import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, addDays } from "date-fns";
import { Scale, CheckCircle, AlertTriangle, Clock, Plus, RefreshCw, FileText, Calculator } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";

interface Reconciliation {
  id: string;
  branch_id: string | null;
  period_type: string;
  period_start: string;
  period_end: string;
  opening_stock_crates: number;
  opening_stock_pieces: number;
  total_production_crates: number;
  total_production_pieces: number;
  total_sales_crates: number;
  total_sales_pieces: number;
  adjustment_crates: number;
  adjustment_pieces: number;
  closing_stock_crates: number;
  closing_stock_pieces: number;
  expected_closing_crates: number;
  expected_closing_pieces: number;
  is_balanced: boolean;
  status: string;
  notes: string | null;
  balanced_at: string | null;
  created_at: string;
}

interface Adjustment {
  id: string;
  reconciliation_id: string;
  adjustment_type: string;
  crates: number;
  pieces: number;
  description: string | null;
  recorded_by: string;
  created_at: string;
}

const ADJUSTMENT_TYPES = [
  { value: "breakage", label: "Breakage" },
  { value: "spoilage", label: "Spoilage" },
  { value: "given_away", label: "Given Away" },
  { value: "theft", label: "Theft/Loss" },
  { value: "counting_error", label: "Counting Error" },
  { value: "other", label: "Other" },
];

const BalancingTab = () => {
  const { currentBranchId } = useBranch();
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [selectedReconciliation, setSelectedReconciliation] = useState<Reconciliation | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustment_type: "breakage",
    crates: "",
    pieces: "",
    description: "",
  });

  const [notesForm, setNotesForm] = useState("");

  useEffect(() => {
    fetchReconciliations();
  }, [currentBranchId, periodType]);

  const fetchReconciliations = async () => {
    setLoading(true);
    let query = supabase
      .from("stock_reconciliations")
      .select("*")
      .eq("period_type", periodType)
      .order("period_start", { ascending: false });

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching reconciliations:", error);
      toast.error("Failed to fetch reconciliation records");
    } else {
      setReconciliations(data || []);
    }
    setLoading(false);
  };

  const fetchAdjustments = async (reconciliationId: string) => {
    const { data, error } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("reconciliation_id", reconciliationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching adjustments:", error);
    } else {
      setAdjustments(data || []);
    }
  };

  const calculatePeriodData = async (startDate: Date, endDate: Date) => {
    const start = format(startDate, "yyyy-MM-dd");
    const end = format(endDate, "yyyy-MM-dd");

    // Get production data for the period
    let productionQuery = supabase
      .from("daily_production")
      .select("crates, pieces")
      .gte("date", start)
      .lte("date", end);

    if (currentBranchId) {
      productionQuery = productionQuery.eq("branch_id", currentBranchId);
    }

    const { data: productionData } = await productionQuery;

    // Get sales data for the period (eggs only)
    let salesQuery = supabase
      .from("sales_records")
      .select("quantity, unit")
      .eq("product_type", "eggs")
      .gte("date", start)
      .lte("date", end);

    if (currentBranchId) {
      salesQuery = salesQuery.eq("branch_id", currentBranchId);
    }

    const { data: salesData } = await salesQuery;

    // Calculate totals
    const totalProduction = productionData?.reduce(
      (acc, curr) => ({
        crates: acc.crates + curr.crates,
        pieces: acc.pieces + curr.pieces,
      }),
      { crates: 0, pieces: 0 }
    ) || { crates: 0, pieces: 0 };

    // Calculate sales (convert units to crates/pieces)
    let salesCrates = 0;
    let salesPieces = 0;
    salesData?.forEach((sale) => {
      if (sale.unit === "crate" || sale.unit === "crates") {
        salesCrates += Number(sale.quantity);
      } else if (sale.unit === "piece" || sale.unit === "pieces") {
        salesPieces += Number(sale.quantity);
      }
    });

    return {
      production: totalProduction,
      sales: { crates: salesCrates, pieces: salesPieces },
    };
  };

  const getLastClosingStock = async (): Promise<{ crates: number; pieces: number }> => {
    let query = supabase
      .from("stock_reconciliations")
      .select("closing_stock_crates, closing_stock_pieces")
      .eq("period_type", periodType)
      .order("period_end", { ascending: false })
      .limit(1);

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return {
        crates: data[0].closing_stock_crates,
        pieces: data[0].closing_stock_pieces,
      };
    }
    return { crates: 0, pieces: 0 };
  };

  const createReconciliation = async () => {
    setCreating(true);
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (periodType === "weekly") {
      // Use previous week
      const lastWeek = subWeeks(now, 1);
      startDate = startOfWeek(lastWeek, { weekStartsOn: 1 }); // Monday
      endDate = endOfWeek(lastWeek, { weekStartsOn: 1 }); // Sunday
    } else {
      // Use previous month
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
    }

    // Check if reconciliation already exists for this period
    let checkQuery = supabase
      .from("stock_reconciliations")
      .select("id")
      .eq("period_type", periodType)
      .eq("period_start", format(startDate, "yyyy-MM-dd"))
      .eq("period_end", format(endDate, "yyyy-MM-dd"));

    if (currentBranchId) {
      checkQuery = checkQuery.eq("branch_id", currentBranchId);
    }

    const { data: existing } = await checkQuery;
    if (existing && existing.length > 0) {
      toast.error("Reconciliation already exists for this period");
      setCreating(false);
      setShowCreateDialog(false);
      return;
    }

    // Get data
    const openingStock = await getLastClosingStock();
    const periodData = await calculatePeriodData(startDate, endDate);

    // Calculate expected closing
    const expectedCrates = openingStock.crates + periodData.production.crates - periodData.sales.crates;
    const expectedPieces = openingStock.pieces + periodData.production.pieces - periodData.sales.pieces;

    // Normalize pieces to crates (30 pieces = 1 crate)
    const normalizedCrates = expectedCrates + Math.floor(expectedPieces / 30);
    const normalizedPieces = expectedPieces % 30;

    const { error } = await supabase.from("stock_reconciliations").insert({
      branch_id: currentBranchId,
      period_type: periodType,
      period_start: format(startDate, "yyyy-MM-dd"),
      period_end: format(endDate, "yyyy-MM-dd"),
      opening_stock_crates: openingStock.crates,
      opening_stock_pieces: openingStock.pieces,
      total_production_crates: periodData.production.crates,
      total_production_pieces: periodData.production.pieces,
      total_sales_crates: periodData.sales.crates,
      total_sales_pieces: periodData.sales.pieces,
      expected_closing_crates: normalizedCrates >= 0 ? normalizedCrates : 0,
      expected_closing_pieces: normalizedPieces >= 0 ? normalizedPieces : 0,
      closing_stock_crates: normalizedCrates >= 0 ? normalizedCrates : 0,
      closing_stock_pieces: normalizedPieces >= 0 ? normalizedPieces : 0,
    });

    if (error) {
      console.error("Error creating reconciliation:", error);
      toast.error("Failed to create reconciliation");
    } else {
      await logActivity("create", "reconciliation", undefined, {
        period_type: periodType,
        period: `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`,
      }, currentBranchId);
      toast.success("Reconciliation created successfully");
      fetchReconciliations();
    }
    setCreating(false);
    setShowCreateDialog(false);
  };

  const addAdjustment = async () => {
    if (!selectedReconciliation) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const crates = parseInt(adjustmentForm.crates) || 0;
    const pieces = parseInt(adjustmentForm.pieces) || 0;

    if (crates === 0 && pieces === 0) {
      toast.error("Please enter at least crates or pieces");
      return;
    }

    const { error } = await supabase.from("stock_adjustments").insert({
      reconciliation_id: selectedReconciliation.id,
      branch_id: currentBranchId,
      adjustment_type: adjustmentForm.adjustment_type,
      crates,
      pieces,
      description: adjustmentForm.description || null,
      recorded_by: user.id,
    });

    if (error) {
      console.error("Error adding adjustment:", error);
      toast.error("Failed to add adjustment");
    } else {
      // Update reconciliation totals
      const newAdjustmentCrates = selectedReconciliation.adjustment_crates + crates;
      const newAdjustmentPieces = selectedReconciliation.adjustment_pieces + pieces;
      
      // Recalculate closing stock with adjustments
      const newClosingCrates = selectedReconciliation.expected_closing_crates - newAdjustmentCrates;
      const newClosingPieces = selectedReconciliation.expected_closing_pieces - newAdjustmentPieces;

      await supabase
        .from("stock_reconciliations")
        .update({
          adjustment_crates: newAdjustmentCrates,
          adjustment_pieces: newAdjustmentPieces,
          closing_stock_crates: newClosingCrates >= 0 ? newClosingCrates : 0,
          closing_stock_pieces: newClosingPieces >= 0 ? newClosingPieces : 0,
          status: "adjusted",
        })
        .eq("id", selectedReconciliation.id);

      await logActivity("create", "stock_adjustment", selectedReconciliation.id, {
        type: adjustmentForm.adjustment_type,
        crates,
        pieces,
      }, currentBranchId);

      toast.success("Adjustment added successfully");
      fetchAdjustments(selectedReconciliation.id);
      fetchReconciliations();
      setAdjustmentForm({ adjustment_type: "breakage", crates: "", pieces: "", description: "" });
      setShowAdjustmentDialog(false);
    }
  };

  const markAsBalanced = async () => {
    if (!selectedReconciliation) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const { error } = await supabase
      .from("stock_reconciliations")
      .update({
        is_balanced: true,
        status: "balanced",
        notes: notesForm || null,
        balanced_by: user.id,
        balanced_at: new Date().toISOString(),
      })
      .eq("id", selectedReconciliation.id);

    if (error) {
      console.error("Error marking as balanced:", error);
      toast.error("Failed to mark as balanced");
    } else {
      await logActivity("update", "reconciliation", selectedReconciliation.id, {
        action: "marked_balanced",
        period: `${selectedReconciliation.period_start} - ${selectedReconciliation.period_end}`,
      }, currentBranchId);
      toast.success("Marked as balanced");
      fetchReconciliations();
      setShowDetailsDialog(false);
    }
  };

  const saveNotes = async () => {
    if (!selectedReconciliation) return;

    const { error } = await supabase
      .from("stock_reconciliations")
      .update({ notes: notesForm })
      .eq("id", selectedReconciliation.id);

    if (error) {
      toast.error("Failed to save notes");
    } else {
      toast.success("Notes saved");
      fetchReconciliations();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "balanced":
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" /> Balanced</Badge>;
      case "adjusted":
        return <Badge variant="secondary"><Calculator className="h-3 w-3 mr-1" /> Adjusted</Badge>;
      case "unresolved":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Unresolved</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  const openDetails = (rec: Reconciliation) => {
    setSelectedReconciliation(rec);
    setNotesForm(rec.notes || "");
    fetchAdjustments(rec.id);
    setShowDetailsDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Stock Balancing
          </h2>
          <p className="text-muted-foreground">Reconcile production vs sales and track inventory</p>
        </div>
        <div className="flex gap-2">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as "weekly" | "monthly")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Period
          </Button>
          <Button variant="outline" onClick={fetchReconciliations}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded"></div>
          ))}
        </div>
      ) : reconciliations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reconciliation records</h3>
            <p className="text-muted-foreground mb-4">Create your first {periodType} reconciliation period</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Period
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation History</CardTitle>
            <CardDescription>Click on a row to view details and make adjustments</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Production</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Adjustments</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((rec) => (
                  <TableRow 
                    key={rec.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetails(rec)}
                  >
                    <TableCell className="font-medium">
                      {format(new Date(rec.period_start), "MMM d")} - {format(new Date(rec.period_end), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {rec.opening_stock_crates}c {rec.opening_stock_pieces}p
                    </TableCell>
                    <TableCell className="text-right text-success">
                      +{rec.total_production_crates}c {rec.total_production_pieces}p
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -{rec.total_sales_crates}c {rec.total_sales_pieces}p
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {rec.adjustment_crates > 0 || rec.adjustment_pieces > 0 
                        ? `-${rec.adjustment_crates}c ${rec.adjustment_pieces}p` 
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {rec.closing_stock_crates}c {rec.closing_stock_pieces}p
                    </TableCell>
                    <TableCell>{getStatusBadge(rec.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Reconciliation Period</DialogTitle>
            <DialogDescription>
              This will create a reconciliation for the previous {periodType === "weekly" ? "week" : "month"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Period to reconcile:</p>
              <p className="font-semibold">
                {periodType === "weekly" 
                  ? `${format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "MMM d")} - ${format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "MMM d, yyyy")}`
                  : `${format(startOfMonth(subMonths(new Date(), 1)), "MMMM yyyy")}`
                }
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={createReconciliation} disabled={creating}>
                {creating ? "Creating..." : "Create Period"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Reconciliation Details
              {selectedReconciliation && getStatusBadge(selectedReconciliation.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedReconciliation && `${format(new Date(selectedReconciliation.period_start), "MMM d")} - ${format(new Date(selectedReconciliation.period_end), "MMM d, yyyy")}`}
            </DialogDescription>
          </DialogHeader>

          {selectedReconciliation && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Opening Stock</p>
                  <p className="text-lg font-bold">{selectedReconciliation.opening_stock_crates}c {selectedReconciliation.opening_stock_pieces}p</p>
                </div>
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-xs text-success">Production</p>
                  <p className="text-lg font-bold text-success">+{selectedReconciliation.total_production_crates}c {selectedReconciliation.total_production_pieces}p</p>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-xs text-destructive">Sales</p>
                  <p className="text-lg font-bold text-destructive">-{selectedReconciliation.total_sales_crates}c {selectedReconciliation.total_sales_pieces}p</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-xs text-primary">Closing Stock</p>
                  <p className="text-lg font-bold">{selectedReconciliation.closing_stock_crates}c {selectedReconciliation.closing_stock_pieces}p</p>
                </div>
              </div>

              {/* Expected vs Actual */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Balance Check</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Closing:</span>
                    <span className="font-medium">{selectedReconciliation.expected_closing_crates}c {selectedReconciliation.expected_closing_pieces}p</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adjustments:</span>
                    <span className="font-medium text-destructive">-{selectedReconciliation.adjustment_crates}c {selectedReconciliation.adjustment_pieces}p</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Actual Closing:</span>
                    <span className="font-bold">{selectedReconciliation.closing_stock_crates}c {selectedReconciliation.closing_stock_pieces}p</span>
                  </div>
                </CardContent>
              </Card>

              {/* Adjustments List */}
              {adjustments.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Adjustments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {adjustments.map((adj) => (
                        <div key={adj.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                          <div>
                            <Badge variant="outline" className="mr-2">
                              {ADJUSTMENT_TYPES.find(t => t.value === adj.adjustment_type)?.label}
                            </Badge>
                            {adj.description && <span className="text-muted-foreground">{adj.description}</span>}
                          </div>
                          <span className="font-medium">-{adj.crates}c {adj.pieces}p</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notesForm}
                  onChange={(e) => setNotesForm(e.target.value)}
                  placeholder="Add notes about this reconciliation..."
                  rows={3}
                />
                <Button variant="outline" size="sm" onClick={saveNotes}>
                  <FileText className="h-4 w-4 mr-2" />
                  Save Notes
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end border-t pt-4">
                {selectedReconciliation.status !== "balanced" && (
                  <>
                    <Button variant="outline" onClick={() => setShowAdjustmentDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Adjustment
                    </Button>
                    <Button onClick={markAsBalanced} className="bg-success hover:bg-success/90">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Balanced
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock Adjustment</DialogTitle>
            <DialogDescription>Record discrepancies like breakage, spoilage, etc.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Adjustment Type</Label>
              <Select 
                value={adjustmentForm.adjustment_type} 
                onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Crates</Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustmentForm.crates}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, crates: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Pieces</Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustmentForm.pieces}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, pieces: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={adjustmentForm.description}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdjustmentDialog(false)}>Cancel</Button>
              <Button onClick={addAdjustment}>Add Adjustment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BalancingTab;
