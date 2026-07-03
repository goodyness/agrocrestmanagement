import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { exportToCSV } from "@/lib/exportUtils";

interface Props { batchIds: string[] }

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function PartnerAnalyticsCharts({ batchIds }: Props) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    if (!batchIds.length) return;
    (async () => {
      const [{ data: exp }, { data: prod }, { data: sls }] = await Promise.all([
        supabase.from("miscellaneous_expenses").select("date, amount, expense_type, category").in("batch_id", batchIds),
        supabase.from("daily_production").select("date, quantity").in("batch_id", batchIds),
        supabase.from("batch_sales").select("sale_date, total_amount").in("batch_id", batchIds),
      ]);
      setExpenses(exp || []);
      setProduction(prod || []);
      setSales(sls || []);
    })();
  }, [batchIds.join(",")]);

  // Monthly production trend
  const monthly: Record<string, number> = {};
  production.forEach((p: any) => {
    const m = (p.date || "").slice(0, 7);
    monthly[m] = (monthly[m] || 0) + Number(p.quantity || 0);
  });
  const monthlyData = Object.entries(monthly).sort().map(([month, quantity]) => ({ month, quantity }));

  // Expense breakdown by category
  const catMap: Record<string, number> = {};
  expenses.forEach((e: any) => {
    const k = (e.category || e.expense_type || "other").toString();
    catMap[k] = (catMap[k] || 0) + Number(e.amount || 0);
  });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  // Cumulative budget vs sales
  const dayMap: Record<string, { date: string; expenses: number; sales: number }> = {};
  expenses.forEach((e: any) => {
    const d = e.date; if (!d) return;
    dayMap[d] = dayMap[d] || { date: d, expenses: 0, sales: 0 };
    dayMap[d].expenses += Number(e.amount || 0);
  });
  sales.forEach((s: any) => {
    const d = s.sale_date; if (!d) return;
    dayMap[d] = dayMap[d] || { date: d, expenses: 0, sales: 0 };
    dayMap[d].sales += Number(s.total_amount || 0);
  });
  const daily = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  let cumE = 0, cumS = 0;
  const cumData = daily.map((d) => ({ date: d.date, cumulativeExpenses: (cumE += d.expenses), cumulativeSales: (cumS += d.sales) }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Monthly Production</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(monthlyData, "monthly-production")}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Expense Breakdown</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(catData, "expense-breakdown")}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="h-64">
          {catData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center pt-16">No expenses recorded yet</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
                <Legend fontSize={10} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Cumulative Expenses vs Sales</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(cumData, "cumulative-flow")}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="cumulativeExpenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={false} />
              <Line type="monotone" dataKey="cumulativeSales" stroke="#22c55e" strokeWidth={2} name="Sales" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
