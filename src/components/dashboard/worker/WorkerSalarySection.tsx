import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingDown, Banknote, CalendarDays } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Props {
  userId: string;
}

const WorkerSalarySection = ({ userId }: Props) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

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

  const monthlySalary = salarySetting ? Number(salarySetting.monthly_salary) : 0;
  const totalAdvances = advances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
  const balance = monthlySalary - totalAdvances;

  if (!salarySetting && advances.length === 0) return null;

  return (
    <Card className="shadow-md border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          My Salary - {MONTHS[currentMonth - 1]} {currentYear}
        </CardTitle>
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
  );
};

export default WorkerSalarySection;
