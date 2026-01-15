import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import {
  exportProductionReport,
  exportSalesReport,
  exportExpensesReport,
  exportLivestockReport,
} from "@/lib/exportUtils";

const ReportsTab = () => {
  const { currentBranchId } = useBranch();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  const handleExport = async (exportFn: Function, reportName: string) => {
    setLoading(true);
    try {
      await exportFn(dateRange.startDate || undefined, dateRange.endDate || undefined, currentBranchId || undefined);
      toast.success(`${reportName} exported successfully!`);
    } catch (error) {
      toast.error(`Failed to export ${reportName}`);
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Export Reports
        </h2>
        <p className="text-muted-foreground">Download data reports as CSV files</p>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
          <CardDescription>Select date range for time-based reports (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Button
              onClick={() => handleExport(exportProductionReport, "Production Report")}
              disabled={loading}
              className="w-full"
            >
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
            <Button
              onClick={() => handleExport(exportSalesReport, "Sales Report")}
              disabled={loading}
              className="w-full"
            >
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
            <CardDescription>Export all miscellaneous expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleExport(exportExpensesReport, "Expenses Report")}
              disabled={loading}
              className="w-full"
            >
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
            <Button
              onClick={() => handleExport(exportLivestockReport, "Livestock Report")}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Exporting..." : "Export Livestock Data"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsTab;
