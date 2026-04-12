import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart, Loader2, Send, Calendar } from "lucide-react";
import { toast } from "sonner";

const WeeklyReportButton = () => {
  const [loading, setLoading] = useState(false);
  const [lastReport, setLastReport] = useState<any>(null);

  const generateReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-report");
      if (error) throw error;
      setLastReport(data?.summary);
      toast.success("Weekly report generated and sent to email!");
    } catch (err: any) {
      toast.error("Failed: " + (err.message || "Unknown error"));
    }
    setLoading(false);
  };

  return (
    <Card className="shadow-md border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileBarChart className="h-5 w-5 text-primary" />
          Automated Weekly Report
        </CardTitle>
        <CardDescription>Generate and email a comprehensive weekly farm report</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={generateReport} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {loading ? "Generating..." : "Generate & Send Weekly Report"}
        </Button>

        {lastReport && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-sm">
            <p className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {lastReport.period}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground">Production</p>
                <p className="font-bold">{lastReport.totalCrates} crates</p>
              </div>
              <div>
                <p className="text-muted-foreground">Revenue</p>
                <p className="font-bold text-success">₦{lastReport.totalRevenue?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expenses</p>
                <p className="font-bold text-destructive">₦{lastReport.totalExpenses?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net Profit</p>
                <p className={`font-bold ${lastReport.netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  ₦{lastReport.netProfit?.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyReportButton;
