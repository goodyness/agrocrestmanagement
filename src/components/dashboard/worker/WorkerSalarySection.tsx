import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, TrendingDown, Banknote, CalendarDays, CheckCircle, FileText, Printer } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Props {
  userId: string;
}

const WorkerSalarySection = ({ userId }: Props) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: salarySetting } = useQuery({
    queryKey: ["my-salary-setting", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_salary_settings")
        .select("*")
        .eq("worker_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: advances = [] } = useQuery({
    queryKey: ["my-advances", userId, currentMonth, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_advances")
        .select("*")
        .eq("worker_id", userId)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .order("advance_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payment } = useQuery({
    queryKey: ["my-payment", userId, currentMonth, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_payments")
        .select("*")
        .eq("worker_id", userId)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const monthlySalary = salarySetting ? Number(salarySetting.monthly_salary) : 0;
  const totalAdvances = advances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
  const balance = monthlySalary - totalAdvances;

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
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        @media print { body { padding: 20px; } }
      </style></head><body>${printContent}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!salarySetting && advances.length === 0) return null;

  return (
    <>
      <Card className="shadow-md border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              My Salary - {MONTHS[currentMonth - 1]} {currentYear}
            </CardTitle>
            {payment && (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle className="h-3 w-3 mr-1" /> Paid
              </Badge>
            )}
          </div>
          <CardDescription>Your salary and advance tracking for this month</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Banknote className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold">₦{monthlySalary.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Monthly Salary</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <TrendingDown className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-bold text-amber-600">₦{totalAdvances.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Collected</p>
            </div>
            <div className={`text-center p-3 rounded-lg border ${balance >= 0 ? "bg-green-500/5 border-green-500/10" : "bg-destructive/5 border-destructive/10"}`}>
              <Wallet className={`h-4 w-4 mx-auto mb-1 ${balance >= 0 ? "text-green-500" : "text-destructive"}`} />
              <p className={`text-lg font-bold ${balance >= 0 ? "text-green-600" : "text-destructive"}`}>
                ₦{Math.abs(balance).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{balance >= 0 ? "Balance" : "Overdrawn"}</p>
            </div>
          </div>

          {/* Payment receipt button */}
          {payment && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowReceipt(true)}>
              <FileText className="h-4 w-4 mr-1" /> View Payment Receipt
            </Button>
          )}

          {/* Advance History */}
          {advances.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Collection History
              </h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-right text-xs">Amount</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.map((adv: any) => (
                      <TableRow key={adv.id}>
                        <TableCell className="text-sm">{new Date(adv.advance_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-amber-600">₦{Number(adv.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{adv.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {advances.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-2">No advances collected this month</p>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Payment Receipt
            </DialogTitle>
          </DialogHeader>
          {payment && (
            <>
              <div ref={receiptRef}>
                <div className="receipt">
                  <div style={{ textAlign: "center", borderBottom: "2px dashed hsl(var(--border))", paddingBottom: 16, marginBottom: 16 }}>
                    <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700 }}>SALARY PAYMENT RECEIPT</h2>
                    <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                      {MONTHS[currentMonth - 1]} {currentYear}
                    </p>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Payment Date</span>
                      <span>{new Date(payment.payment_date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Method</span>
                      <span style={{ textTransform: "capitalize" }}>{(payment.payment_method || "cash").replace("_", " ")}</span>
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span>Gross Salary</span>
                      <span>₦{Number(payment.gross_salary).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: "#c53030" }}>
                      <span>Less: Advances</span>
                      <span>-₦{Number(payment.total_advances).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 6px", fontSize: 16, fontWeight: 700, borderTop: "2px solid hsl(var(--foreground))", marginTop: 8 }}>
                      <span>Net Amount Paid</span>
                      <span style={{ color: "#38a169" }}>₦{Number(payment.net_paid).toLocaleString()}</span>
                    </div>
                  </div>
                  {payment.notes && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "hsl(var(--muted))", borderRadius: 6, fontSize: 13 }}>
                      <strong>Notes:</strong> {payment.notes}
                    </div>
                  )}
                  <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "2px dashed hsl(var(--border))", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                    <p>Generated on {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReceipt(false)}>Close</Button>
                <Button onClick={handlePrintReceipt}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkerSalarySection;
