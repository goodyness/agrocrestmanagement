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

interface Props { batchId: string }
const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function BatchAnalyticsCharts({ batchId }: Props) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [vacc, setVacc] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    if (!batchId) return;
    (async () => {
      const [{ data: e }, { data: f }, { data: v }, { data: s }] = await Promise.all([
        supabase.from("miscellaneous_expenses").select("date, amount, expense_type, category").eq("batch_id", batchId),
        supabase.from("feed_consumption").select("date, quantity_used").eq("batch_id", batchId),
        supabase.from("vaccination_records").select("date_administered").eq("batch_id", batchId),
        supabase.from("batch_sales").select("sale_date, total_amount").eq("batch_id", batchId),
      ]);
      setExpenses(e || []); setFeed(f || []); setVacc(v || []); setSales(s || []);
    })();
  }, [batchId]);

  // Cumulative expenses vs sales
  const dayMap: Record<string, { date: string; expenses: number; sales: number }> = {};
  expenses.forEach((r: any) => { const d = r.date; if (!d) return; dayMap[d] = dayMap[d] || { date: d, expenses: 0, sales: 0 }; dayMap[d].expenses += Number(r.amount || 0); });
  sales.forEach((r: any) => { const d = r.sale_date; if (!d) return; dayMap[d] = dayMap[d] || { date: d, expenses: 0, sales: 0 }; dayMap[d].sales += Number(r.total_amount || 0); });
  const daily = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  let cE = 0, cS = 0;
  const cum = daily.map((d) => ({ date: d.date, Expenses: (cE += d.expenses), Sales: (cS += d.sales) }));

  // Weekly feed vs vaccine count
  const weekly: Record<string, { week: string; Feed: number; Vaccines: number }> = {};
  const wk = (d: string) => { const dt = new Date(d); const one = new Date(dt.getFullYear(), 0, 1); const w = Math.ceil(((+dt - +one) / 86400000 + one.getDay() + 1) / 7); return `${dt.getFullYear()}-W${String(w).padStart(2, "0")}`; };
  feed.forEach((r: any) => { if (!r.date) return; const k = wk(r.date); weekly[k] = weekly[k] || { week: k, Feed: 0, Vaccines: 0 }; weekly[k].Feed += Number(r.quantity_used || 0); });
  vacc.forEach((r: any) => { if (!r.date_administered) return; const k = wk(r.date_administered); weekly[k] = weekly[k] || { week: k, Feed: 0, Vaccines: 0 }; weekly[k].Vaccines += 1; });
  const weeklyData = Object.values(weekly).sort((a, b) => a.week.localeCompare(b.week));

  // Expense category breakdown
  const cat: Record<string, number> = {};
  expenses.forEach((e: any) => { const k = (e.category || e.expense_type || "other").toString(); cat[k] = (cat[k] || 0) + Number(e.amount || 0); });
  const catData = Object.entries(cat).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Cumulative Expenses vs Sales</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(cum, `batch-flow-${batchId}`)}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cum}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={10} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Sales" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Feed & Vaccines Weekly</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(weeklyData, `batch-weekly-${batchId}`)}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="week" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Feed" fill="hsl(var(--primary))" />
              <Bar dataKey="Vaccines" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Expense Categories</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(catData, `batch-cats-${batchId}`)}><Download className="h-3 w-3" /></Button>
        </CardHeader>
        <CardContent className="h-56">
          {catData.length === 0 ? <p className="text-xs text-muted-foreground text-center pt-16">No data</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" outerRadius={70} label={(e) => e.name}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
