import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Plus, Settings, Wallet, TrendingDown, Banknote, CheckCircle, FileText, Printer, X } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const WorkerSalaryTab = () => {
  const queryClient = useQueryClient();
  const { currentBranchId } = useBranch();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Set salary dialog
  const [showSetSalary, setShowSetSalary] = useState(false);
  const [salaryWorkerId, setSalaryWorkerId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");

  // Add advance dialog
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [advanceWorkerId, setAdvanceWorkerId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDescription, setAdvanceDescription] = useState("");
  const [advanceDate, setAdvanceDate] = useState(now.toISOString().split("T")[0]);

  // Mark as paid dialog
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [payWorkerId, setPayWorkerId] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(now.toISOString().split("T")[0]);

  // Receipt dialog
  const [showReceipt, setShowReceipt] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Fetch workers
  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-salary", currentBranchId],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id, name, email, branch_id").eq("role", "worker");
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch salary settings
  const { data: salarySettings = [] } = useQuery({
    queryKey: ["salary-settings", currentBranchId],
    queryFn: async () => {
      const workerIds = workers.map((w) => w.id);
      if (workerIds.length === 0) return [];
      const { data, error } = await supabase
        .from("worker_salary_settings")
        .select("*")
        .in("worker_id", workerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: workers.length > 0,
  });

  // Fetch advances for selected month
  const { data: advances = [] } = useQuery({
    queryKey: ["salary-advances", selectedMonth, selectedYear, currentBranchId],
    queryFn: async () => {
      const workerIds = workers.map((w) => w.id);
      if (workerIds.length === 0) return [];
      const { data, error } = await supabase
        .from("salary_advances")
        .select("*, profiles:worker_id(name)")
        .in("worker_id", workerIds)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .order("advance_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: workers.length > 0,
  });

  // Fetch payments for selected month
  const { data: payments = [] } = useQuery({
    queryKey: ["salary-payments", selectedMonth, selectedYear, currentBranchId],
    queryFn: async () => {
      const workerIds = workers.map((w) => w.id);
      if (workerIds.length === 0) return [];
      const { data, error } = await supabase
        .from("salary_payments")
        .select("*, profiles:worker_id(name)")
        .in("worker_id", workerIds)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (error) throw error;
      return data || [];
    },
    enabled: workers.length > 0,
  });

  const getSalary = (workerId: string) => {
    const setting = salarySettings.find((s: any) => s.worker_id === workerId);
    return setting ? Number(setting.monthly_salary) : 0;
  };

  const getTotalAdvances = (workerId: string) => {
    return advances
      .filter((a: any) => a.worker_id === workerId)
      .reduce((sum: number, a: any) => sum + Number(a.amount), 0);
  };

  const getPayment = (workerId: string) => {
    return payments.find((p: any) => p.worker_id === workerId);
  };

  const handleSetSalary = async () => {
    if (!salaryWorkerId || !salaryAmount) return;
    const existing = salarySettings.find((s: any) => s.worker_id === salaryWorkerId);
    if (existing) {
      const { error } = await supabase
        .from("worker_salary_settings")
        .update({ monthly_salary: Number(salaryAmount), updated_at: new Date().toISOString() })
        .eq("worker_id", salaryWorkerId);
      if (error) { toast.error("Failed to update salary"); return; }
    } else {
      const { error } = await supabase
        .from("worker_salary_settings")
        .insert({ worker_id: salaryWorkerId, monthly_salary: Number(salaryAmount) });
      if (error) { toast.error("Failed to set salary"); return; }
    }
    toast.success("Salary updated");
    setShowSetSalary(false);
    setSalaryWorkerId("");
    setSalaryAmount("");
    queryClient.invalidateQueries({ queryKey: ["salary-settings"] });
  };

  const handleAddAdvance = async () => {
    if (!advanceWorkerId || !advanceAmount) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    const { error } = await supabase.from("salary_advances").insert({
      worker_id: advanceWorkerId,
      amount: Number(advanceAmount),
      advance_date: advanceDate,
      description: advanceDescription || null,
      recorded_by: userId!,
      month: selectedMonth,
      year: selectedYear,
    });
    if (error) { toast.error("Failed to record advance"); return; }
    toast.success("Advance recorded");
    setShowAddAdvance(false);
    setAdvanceWorkerId("");
    setAdvanceAmount("");
    setAdvanceDescription("");
    queryClient.invalidateQueries({ queryKey: ["salary-advances"] });
  };

  const handleMarkPaid = async () => {
    if (!payWorkerId) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    const salary = getSalary(payWorkerId);
    const totalAdv = getTotalAdvances(payWorkerId);
    const netPaid = Math.max(salary - totalAdv, 0);

    const { data, error } = await supabase.from("salary_payments").insert({
      worker_id: payWorkerId,
      month: selectedMonth,
      year: selectedYear,
      gross_salary: salary,
      total_advances: totalAdv,
      net_paid: netPaid,
      payment_date: payDate,
      payment_method: payMethod,
      notes: payNotes || null,
      paid_by: userId!,
    }).select("*, profiles:worker_id(name)").single();

    if (error) {
      if (error.code === "23505") {
        toast.error("This worker has already been paid for this month");
      } else {
        toast.error("Failed to record payment");
      }
      return;
    }

    toast.success("Payment recorded successfully!");
    setShowMarkPaid(false);
    setPayWorkerId("");
    setPayMethod("cash");
    setPayNotes("");
    queryClient.invalidateQueries({ queryKey: ["salary-payments"] });
    // Show receipt
    if (data) setShowReceipt(data);
  };

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;
    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Salary Receipt</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; max-width: 500px; margin: 0 auto; }
        .receipt { border: 2px solid #333; padding: 24px; border-radius: 8px; }
        .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 16px; margin-bottom: 16px; }
        .header h2 { margin: 0 0 4px 0; font-size: 20px; }
        .header p { margin: 0; color: #666; font-size: 13px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .row.total { border-top: 2px solid #333; margin-top: 8px; padding-top: 12px; font-weight: bold; font-size: 16px; }
        .row.deduction { color: #c53030; }
        .footer { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 2px dashed #ccc; font-size: 12px; color: #666; }
        @media print { body { padding: 20px; } }
      </style></head><body>${printContent}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const openReceiptForPayment = (payment: any) => {
    setShowReceipt(payment);
  };

  const totalSalaryBill = workers.reduce((sum, w) => sum + getSalary(w.id), 0);
  const totalAdvancesThisMonth = advances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.net_paid), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Banknote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">₦{totalSalaryBill.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Salary Bill</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingDown className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-bold">₦{totalAdvancesThisMonth.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Advances</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Wallet className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold">₦{(totalSalaryBill - totalAdvancesThisMonth).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Net Payable</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold">₦{totalPaid.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions + Month selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={showSetSalary} onOpenChange={setShowSetSalary}>
          <DialogTrigger asChild>
            <Button size="sm"><Settings className="h-4 w-4 mr-1" /> Set Salary</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Set Worker Salary</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Worker</Label>
                <Select value={salaryWorkerId} onValueChange={setSalaryWorkerId}>
                  <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name} ({w.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly Salary (₦)</Label>
                <Input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} placeholder="e.g. 50000" />
              </div>
              <Button onClick={handleSetSalary} className="w-full">Save Salary</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddAdvance} onOpenChange={setShowAddAdvance}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Record Advance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Salary Advance</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Worker</Label>
                <Select value={advanceWorkerId} onValueChange={setAdvanceWorkerId}>
                  <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (₦)</Label>
                <Input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="e.g. 5000" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea value={advanceDescription} onChange={(e) => setAdvanceDescription(e.target.value)} placeholder="Reason for advance..." />
              </div>
              <Button onClick={handleAddAdvance} className="w-full">Record Advance</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showMarkPaid} onOpenChange={setShowMarkPaid}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary"><CheckCircle className="h-4 w-4 mr-1" /> Mark as Paid</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Mark Salary as Paid</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Worker</Label>
                <Select value={payWorkerId} onValueChange={setPayWorkerId}>
                  <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                  <SelectContent>
                    {workers.filter(w => !getPayment(w.id) && getSalary(w.id) > 0).map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {payWorkerId && (
                <div className="rounded-lg border p-3 space-y-1 bg-muted/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Salary</span>
                    <span className="font-medium">₦{getSalary(payWorkerId).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Advances</span>
                    <span>-₦{getTotalAdvances(payWorkerId).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-1">
                    <span>Net Payable</span>
                    <span className="text-green-600">₦{Math.max(getSalary(payWorkerId) - getTotalAdvances(payWorkerId), 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Payment notes..." />
              </div>
              <Button onClick={handleMarkPaid} className="w-full">
                <CheckCircle className="h-4 w-4 mr-1" /> Confirm Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="ml-auto flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Worker Salary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Salaries & Advances</CardTitle>
          <CardDescription>{MONTHS[selectedMonth - 1]} {selectedYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Advances</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No workers found</TableCell>
                  </TableRow>
                ) : (
                  workers.map((w) => {
                    const salary = getSalary(w.id);
                    const totalAdv = getTotalAdvances(w.id);
                    const balance = salary - totalAdv;
                    const payment = getPayment(w.id);
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-right">
                          {salary > 0 ? `₦${salary.toLocaleString()}` : (
                            <span className="text-muted-foreground text-xs">Not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalAdv > 0 ? (
                            <span className="text-amber-600 font-medium">₦{totalAdv.toLocaleString()}</span>
                          ) : "₦0"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {balance >= 0 ? (
                            <span className="text-green-600">₦{balance.toLocaleString()}</span>
                          ) : (
                            <span className="text-destructive">-₦{Math.abs(balance).toLocaleString()}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment ? (
                            <Badge className="bg-green-500/10 text-green-600 text-xs border-green-500/20">
                              <CheckCircle className="h-3 w-3 mr-1" /> Paid
                            </Badge>
                          ) : salary === 0 ? (
                            <Badge variant="outline" className="text-xs">No salary</Badge>
                          ) : totalAdv >= salary ? (
                            <Badge variant="destructive" className="text-xs">Fully Drawn</Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 text-xs border-amber-500/20">Unpaid</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment ? (
                            <Button size="sm" variant="ghost" onClick={() => openReceiptForPayment(payment)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          ) : salary > 0 ? (
                            <Button size="sm" variant="ghost" onClick={() => { setPayWorkerId(w.id); setShowMarkPaid(true); }}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Advances */}
      {advances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advance History</CardTitle>
            <CardDescription>All advances for {MONTHS[selectedMonth - 1]} {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((adv: any) => (
                    <TableRow key={adv.id}>
                      <TableCell>{new Date(adv.advance_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{adv.profiles?.name || "Unknown"}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">₦{Number(adv.amount).toLocaleString()}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{adv.description || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receipt Dialog */}
      <Dialog open={!!showReceipt} onOpenChange={(open) => !open && setShowReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Salary Payment Receipt
            </DialogTitle>
          </DialogHeader>
          {showReceipt && (
            <>
              <div ref={receiptRef}>
                <div className="receipt">
                  <div className="header" style={{ textAlign: "center", borderBottom: "2px dashed hsl(var(--border))", paddingBottom: 16, marginBottom: 16 }}>
                    <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700 }}>SALARY PAYMENT RECEIPT</h2>
                    <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                      {MONTHS[(showReceipt.month || 1) - 1]} {showReceipt.year}
                    </p>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Worker</span>
                      <span style={{ fontWeight: 600 }}>{showReceipt.profiles?.name || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Payment Date</span>
                      <span>{new Date(showReceipt.payment_date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Payment Method</span>
                      <span style={{ textTransform: "capitalize" }}>{(showReceipt.payment_method || "cash").replace("_", " ")}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span>Gross Salary</span>
                      <span>₦{Number(showReceipt.gross_salary).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: "#c53030" }}>
                      <span>Less: Advances</span>
                      <span>-₦{Number(showReceipt.total_advances).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 6px", fontSize: 16, fontWeight: 700, borderTop: "2px solid hsl(var(--foreground))", marginTop: 8 }}>
                      <span>Net Amount Paid</span>
                      <span style={{ color: "#38a169" }}>₦{Number(showReceipt.net_paid).toLocaleString()}</span>
                    </div>
                  </div>

                  {showReceipt.notes && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "hsl(var(--muted))", borderRadius: 6, fontSize: 13 }}>
                      <strong>Notes:</strong> {showReceipt.notes}
                    </div>
                  )}

                  <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "2px dashed hsl(var(--border))", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                    <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReceipt(null)}>Close</Button>
                <Button onClick={handlePrintReceipt}><Printer className="h-4 w-4 mr-1" /> Print Receipt</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerSalaryTab;
