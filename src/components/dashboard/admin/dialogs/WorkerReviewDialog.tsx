import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ClipboardCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface Worker {
  id: string;
  name: string;
  email: string | null;
  branch_id: string | null;
}

interface WorkerReviewDialogProps {
  onSuccess: () => void;
  branchId: string | null;
  editReview?: any;
  triggerButton?: React.ReactNode;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WorkerReviewDialog = ({ onSuccess, branchId, editReview, triggerButton }: WorkerReviewDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [reviewMonth, setReviewMonth] = useState(new Date().getMonth() + 1);
  const [reviewYear, setReviewYear] = useState(new Date().getFullYear());
  const [score, setScore] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [hasBalanceDebt, setHasBalanceDebt] = useState(false);
  const [balanceDebtAmount, setBalanceDebtAmount] = useState("");
  const [hasEquipmentDebt, setHasEquipmentDebt] = useState(false);
  const [equipmentDebtAmount, setEquipmentDebtAmount] = useState("");
  const [equipmentDebtDescription, setEquipmentDebtDescription] = useState("");

  const isEditing = !!editReview;

  useEffect(() => {
    if (open) {
      fetchWorkers();
      if (editReview) {
        setSelectedWorker(editReview.worker_id);
        setReviewMonth(editReview.review_month);
        setReviewYear(editReview.review_year);
        setScore(editReview.score);
        setReviewText(editReview.review_text);
        setSalaryAmount(String(editReview.salary_amount));
        setHasBalanceDebt(editReview.has_balance_debt);
        setBalanceDebtAmount(String(editReview.balance_debt_amount || ""));
        setHasEquipmentDebt(editReview.has_equipment_debt);
        setEquipmentDebtAmount(String(editReview.equipment_debt_amount || ""));
        setEquipmentDebtDescription(editReview.equipment_debt_description || "");
      }
    }
  }, [open]);

  const fetchWorkers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, branch_id")
      .eq("role", "worker")
      .eq("is_suspended", false)
      .order("name");
    setWorkers(data || []);
  };

  const resetForm = () => {
    setSelectedWorker("");
    setScore(5);
    setReviewText("");
    setSalaryAmount("");
    setHasBalanceDebt(false);
    setBalanceDebtAmount("");
    setHasEquipmentDebt(false);
    setEquipmentDebtAmount("");
    setEquipmentDebtDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker || !reviewText || !salaryAmount) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be logged in"); setLoading(false); return; }

    const salary = parseFloat(salaryAmount);
    const balDebt = hasBalanceDebt ? parseFloat(balanceDebtAmount || "0") : 0;
    const eqDebt = hasEquipmentDebt ? parseFloat(equipmentDebtAmount || "0") : 0;
    const totalDebt = balDebt + eqDebt;

    if (isEditing) {
      // Update existing review
      const { error } = await supabase
        .from("worker_reviews")
        .update({
          worker_id: selectedWorker,
          review_month: reviewMonth,
          review_year: reviewYear,
          score,
          review_text: reviewText,
          salary_amount: salary,
          has_balance_debt: hasBalanceDebt,
          balance_debt_amount: balDebt,
          has_equipment_debt: hasEquipmentDebt,
          equipment_debt_amount: eqDebt,
          equipment_debt_description: equipmentDebtDescription || null,
          total_debt: totalDebt,
        })
        .eq("id", editReview.id);

      if (error) {
        toast.error("Failed to update review");
        setLoading(false);
        return;
      }

      // Update linked salary expense if exists
      if (editReview.salary_expense_id) {
        await supabase
          .from("miscellaneous_expenses")
          .update({
            amount: salary,
            description: `Salary for ${workers.find(w => w.id === selectedWorker)?.name} - ${MONTHS[reviewMonth - 1]} ${reviewYear}`,
          })
          .eq("id", editReview.salary_expense_id);
      }

      await logActivity("update", "worker_review", editReview.id, {
        worker_name: workers.find(w => w.id === selectedWorker)?.name,
        month: MONTHS[reviewMonth - 1],
        year: reviewYear,
        score,
      });

      toast.success("Review updated successfully");
    } else {
      // Create salary expense
      const { data: expenseData, error: expenseError } = await supabase
        .from("miscellaneous_expenses")
        .insert({
          expense_type: "Salary",
          amount: salary,
          description: `Salary for ${workers.find(w => w.id === selectedWorker)?.name} - ${MONTHS[reviewMonth - 1]} ${reviewYear}`,
          created_by: user.id,
          date: new Date().toISOString().split('T')[0],
          branch_id: branchId,
        })
        .select("id")
        .single();

      if (expenseError) {
        toast.error("Failed to record salary expense");
        setLoading(false);
        return;
      }

      const { error: reviewError } = await supabase
        .from("worker_reviews")
        .insert({
          worker_id: selectedWorker,
          reviewer_id: user.id,
          review_month: reviewMonth,
          review_year: reviewYear,
          score,
          review_text: reviewText,
          salary_amount: salary,
          salary_expense_id: expenseData.id,
          has_balance_debt: hasBalanceDebt,
          balance_debt_amount: balDebt,
          has_equipment_debt: hasEquipmentDebt,
          equipment_debt_amount: eqDebt,
          equipment_debt_description: equipmentDebtDescription || null,
          total_debt: totalDebt,
        });

      if (reviewError) {
        if (reviewError.code === '23505') {
          toast.error("A review already exists for this worker this month");
        } else {
          toast.error("Failed to create review");
        }
        setLoading(false);
        return;
      }

      await logActivity("create", "worker_review", selectedWorker, {
        worker_name: workers.find(w => w.id === selectedWorker)?.name,
        month: MONTHS[reviewMonth - 1],
        year: reviewYear,
        score,
        salary,
        total_debt: totalDebt,
      });

      toast.success("Worker review submitted & salary recorded as expense");
    }

    resetForm();
    setOpen(false);
    onSuccess();
    setLoading(false);
  };

  const scoreColor = score >= 8 ? "text-green-600" : score >= 5 ? "text-yellow-600" : "text-destructive";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="default">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Write Review
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Worker Review" : "Monthly Worker Review"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the review details" : "Score and review a worker's performance, record salary and debts"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Worker Selection */}
          <div className="space-y-2">
            <Label>Worker *</Label>
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
              <SelectContent>
                {workers.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month/Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Month *</Label>
              <Select value={String(reviewMonth)} onValueChange={v => setReviewMonth(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year *</Label>
              <Input type="number" value={reviewYear} onChange={e => setReviewYear(parseInt(e.target.value))} min={2024} max={2030} />
            </div>
          </div>

          {/* Score */}
          <div className="space-y-2">
            <Label>Performance Score (1-10) *</Label>
            <div className="flex items-center gap-3">
              <Input type="range" min={1} max={10} value={score} onChange={e => setScore(parseInt(e.target.value))} className="flex-1" />
              <span className={`text-2xl font-bold ${scoreColor}`}>{score}/10</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <Star key={i} className={`h-4 w-4 cursor-pointer ${i < score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} onClick={() => setScore(i + 1)} />
              ))}
            </div>
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label>Review *</Label>
            <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Write your assessment of this worker's performance..." rows={4} required />
          </div>

          {/* Salary */}
          <div className="space-y-2">
            <Label>Salary Amount (₦) *</Label>
            <Input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
            <p className="text-xs text-muted-foreground">This will be automatically added as a salary expense</p>
          </div>

          {/* Debt Section */}
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-sm">Debt Management</span>
              </div>

              {/* Balance Debt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Account imbalance debt?</Label>
                  <Switch checked={hasBalanceDebt} onCheckedChange={setHasBalanceDebt} />
                </div>
                {hasBalanceDebt && (
                  <Input type="number" value={balanceDebtAmount} onChange={e => setBalanceDebtAmount(e.target.value)} placeholder="Amount owed (₦)" min="0" step="0.01" />
                )}
              </div>

              {/* Equipment Debt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Equipment/appliance mishandling debt?</Label>
                  <Switch checked={hasEquipmentDebt} onCheckedChange={setHasEquipmentDebt} />
                </div>
                {hasEquipmentDebt && (
                  <>
                    <Input type="number" value={equipmentDebtAmount} onChange={e => setEquipmentDebtAmount(e.target.value)} placeholder="Worth of damage (₦)" min="0" step="0.01" />
                    <Input value={equipmentDebtDescription} onChange={e => setEquipmentDebtDescription(e.target.value)} placeholder="Describe the item/damage..." />
                  </>
                )}
              </div>

              {(hasBalanceDebt || hasEquipmentDebt) && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Debt:</span>
                    <Badge variant="destructive">
                      ₦{((parseFloat(balanceDebtAmount || "0") + parseFloat(equipmentDebtAmount || "0"))).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : isEditing ? "Update Review" : "Submit Review & Record Salary"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerReviewDialog;
