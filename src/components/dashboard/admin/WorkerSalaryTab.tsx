import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Plus, Settings, Wallet, TrendingDown, Banknote } from "lucide-react";
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

  const getSalary = (workerId: string) => {
    const setting = salarySettings.find((s: any) => s.worker_id === workerId);
    return setting ? Number(setting.monthly_salary) : 0;
  };

  const getTotalAdvances = (workerId: string) => {
    return advances
      .filter((a: any) => a.worker_id === workerId)
      .reduce((sum: number, a: any) => sum + Number(a.amount), 0);
  };

  const handleSetSalary = async () => {
    if (!salaryWorkerId || !salaryAmount) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;

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

  const totalSalaryBill = workers.reduce((sum, w) => sum + getSalary(w.id), 0);
  const totalAdvancesThisMonth = advances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Banknote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">₦{totalSalaryBill.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Monthly Salary Bill</p>
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
                <p className="text-2xl font-bold">₦{totalAdvancesThisMonth.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Advances ({MONTHS[selectedMonth - 1]})</p>
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
                <p className="text-2xl font-bold">₦{(totalSalaryBill - totalAdvancesThisMonth).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Net Payable</p>
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
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead className="text-right">Total Advances</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No workers found</TableCell>
                  </TableRow>
                ) : (
                  workers.map((w) => {
                    const salary = getSalary(w.id);
                    const totalAdv = getTotalAdvances(w.id);
                    const balance = salary - totalAdv;
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
                          {salary === 0 ? (
                            <Badge variant="outline" className="text-xs">No salary</Badge>
                          ) : totalAdv === 0 ? (
                            <Badge className="bg-green-500/10 text-green-600 text-xs border-green-500/20">Clear</Badge>
                          ) : totalAdv >= salary ? (
                            <Badge variant="destructive" className="text-xs">Fully Drawn</Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 text-xs border-amber-500/20">Partial</Badge>
                          )}
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
    </div>
  );
};

export default WorkerSalaryTab;
