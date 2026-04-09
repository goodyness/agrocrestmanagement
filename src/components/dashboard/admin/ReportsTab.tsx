import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, Send, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { supabase } from "@/integrations/supabase/client";
import {
  exportProductionReport,
  exportSalesReport,
  exportExpensesReport,
  exportLivestockReport,
} from "@/lib/exportUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ReportsTab = () => {
  const { currentBranchId } = useBranch();
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });

  const handleExport = async (exportFn: Function, reportName: string) => {
    setLoading(true);
    try {
      await exportFn(dateRange.startDate || undefined, dateRange.endDate || undefined, currentBranchId || undefined);
      toast.success(`${reportName} exported successfully!`);
    } catch (error) {
      toast.error(`Failed to export ${reportName}`);
    }
    setLoading(false);
  };

  const handleSendDailySummary = async () => {
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-farm-summary");
      if (error) throw error;
      toast.success("Daily summary sent to email!");
    } catch (error: any) {
      toast.error("Failed to send: " + (error.message || "Unknown error"));
    }
    setSendingEmail(false);
  };

  const generatePLReport = async () => {
    setLoading(true);
    try {
      const start = dateRange.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const end = dateRange.endDate || new Date().toISOString().split("T")[0];

      // Fetch data
      let salesQ = supabase.from("sales_records").select("total_amount, product_type, date").gte("date", start).lte("date", end);
      let expensesQ = supabase.from("miscellaneous_expenses").select("amount, expense_type, date").gte("date", start).lte("date", end);
      let feedQ = supabase.from("feed_purchases").select("total_cost, date").gte("date", start).lte("date", end);
      
      if (currentBranchId) {
        salesQ = salesQ.eq("branch_id", currentBranchId);
        expensesQ = expensesQ.eq("branch_id", currentBranchId);
        feedQ = feedQ.eq("branch_id", currentBranchId);
      }

      const [{ data: sales }, { data: expenses }, { data: feedPurchases }] = await Promise.all([salesQ, expensesQ, feedQ]);

      // Revenue breakdown
      const revenueByType: Record<string, number> = {};
      (sales || []).forEach((s) => {
        const type = s.product_type || "Other";
        revenueByType[type] = (revenueByType[type] || 0) + Number(s.total_amount);
      });
      const totalRevenue = Object.values(revenueByType).reduce((s, v) => s + v, 0);

      // Expense breakdown
      const expenseByType: Record<string, number> = {};
      (expenses || []).forEach((e) => {
        expenseByType[e.expense_type] = (expenseByType[e.expense_type] || 0) + Number(e.amount);
      });
      const feedCost = (feedPurchases || []).reduce((s, f) => s + Number(f.total_cost), 0);
      if (feedCost > 0) expenseByType["Feed Purchases"] = feedCost;
      const totalExpenses = Object.values(expenseByType).reduce((s, v) => s + v, 0);

      // Generate PDF
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("PROFIT & LOSS STATEMENT", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text("Agrocrest Farm", 105, 28, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Period: ${start} to ${end}`, 105, 35, { align: "center" });

      let y = 50;
      // Revenue Section
      doc.setFontSize(14);
      doc.text("REVENUE", 14, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [["Category", "Amount (₦)"]],
        body: [
          ...Object.entries(revenueByType).map(([type, amount]) => [type, `₦${(amount as number).toLocaleString()}`]),
          [{ content: "TOTAL REVENUE", styles: { fontStyle: "bold" } }, { content: `₦${totalRevenue.toLocaleString()}`, styles: { fontStyle: "bold" } }],
        ],
        theme: "grid",
        headStyles: { fillColor: [34, 139, 34] },
      });

      y = (doc as any).lastAutoTable.finalY + 15;
      // Expenses Section
      doc.setFontSize(14);
      doc.text("EXPENSES", 14, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [["Category", "Amount (₦)"]],
        body: [
          ...Object.entries(expenseByType).map(([type, amount]) => [type, `₦${(amount as number).toLocaleString()}`]),
          [{ content: "TOTAL EXPENSES", styles: { fontStyle: "bold" } }, { content: `₦${totalExpenses.toLocaleString()}`, styles: { fontStyle: "bold" } }],
        ],
        theme: "grid",
        headStyles: { fillColor: [220, 53, 69] },
      });

      y = (doc as any).lastAutoTable.finalY + 15;
      const netProfit = totalRevenue - totalExpenses;
      doc.setFontSize(16);
      doc.text(`NET PROFIT: ₦${netProfit.toLocaleString()}`, 14, y);
      doc.setTextColor(netProfit >= 0 ? 34 : 220, netProfit >= 0 ? 139 : 53, netProfit >= 0 ? 34 : 69);
      doc.text(netProfit >= 0 ? "(PROFIT)" : "(LOSS)", 14, y + 8);

      doc.save(`Agrocrest_PL_${start}_to_${end}.pdf`);
      toast.success("P&L statement generated!");
    } catch (error: any) {
      toast.error("Failed to generate P&L: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Reports & Exports
        </h2>
        <p className="text-muted-foreground">Generate reports, export data, and send email summaries</p>
      </div>

      {/* Email Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Automated Email Reports
          </CardTitle>
          <CardDescription>Send a comprehensive farm summary to admin email</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSendDailySummary} disabled={sendingEmail} className="w-full sm:w-auto">
            {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sendingEmail ? "Sending..." : "Send Daily Summary Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Date Range */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
          <CardDescription>Filter reports by date (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* P&L Report */}
      <Card className="shadow-md hover:shadow-lg transition-shadow border-success/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-success" />
            Profit & Loss Statement
          </CardTitle>
          <CardDescription>Generate a comprehensive P&L report as PDF</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generatePLReport} disabled={loading} className="w-full" variant="default">
            {loading ? "Generating..." : "Generate P&L Report (PDF)"}
          </Button>
        </CardContent>
      </Card>

      {/* CSV Exports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Production Report
            </CardTitle>
            <CardDescription>Export daily egg production records</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => handleExport(exportProductionReport, "Production Report")} disabled={loading} className="w-full">
              {loading ? "Exporting..." : "Export Production Data"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-success" />
              Sales Report
            </CardTitle>
            <CardDescription>Export all sales transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => handleExport(exportSalesReport, "Sales Report")} disabled={loading} className="w-full">
              {loading ? "Exporting..." : "Export Sales Data"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-destructive" />
              Expenses Report
            </CardTitle>
            <CardDescription>Export all expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => handleExport(exportExpensesReport, "Expenses Report")} disabled={loading} className="w-full">
              {loading ? "Exporting..." : "Export Expenses Data"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-accent" />
              Livestock Report
            </CardTitle>
            <CardDescription>Export livestock census data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => handleExport(exportLivestockReport, "Livestock Report")} disabled={loading} className="w-full">
              {loading ? "Exporting..." : "Export Livestock Data"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsTab;
