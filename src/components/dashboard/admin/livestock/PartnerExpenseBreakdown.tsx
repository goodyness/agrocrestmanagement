import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Lock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { exportToCSV } from "@/lib/exportUtils";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

interface Props {
  expenses: any[];
}

export default function PartnerExpenseBreakdown({ expenses }: Props) {
  const total = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses]
  );

  const byCategory = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    expenses.forEach((e) => {
      const key = e.expense_type || "Uncategorized";
      if (!map[key]) map[key] = { amount: 0, count: 0 };
      map[key].amount += Number(e.amount || 0);
      map[key].count += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, pct: total > 0 ? (v.amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, total]);

  const byRecorder = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    expenses.forEach((e) => {
      const key = e.profiles?.name || "Unknown";
      if (!map[key]) map[key] = { amount: 0, count: 0 };
      map[key].amount += Number(e.amount || 0);
      map[key].count += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, pct: total > 0 ? (v.amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, total]);

  if (expenses.length === 0) return null;

  const topCategory = byCategory[0];

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Partnership Expense Insights
              <Badge variant="outline" className="text-[10px]">Admin only</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Where the money goes on this partnered batch, and who recorded what.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCSV(
                [
                  ...byCategory.map((c) => ({ group: "Category", name: c.name, entries: c.count, amount: c.amount, percent: c.pct.toFixed(1) })),
                  ...byRecorder.map((r) => ({ group: "Recorder", name: r.name, entries: r.count, amount: r.amount, percent: r.pct.toFixed(1) })),
                ],
                "partner-expense-breakdown"
              )
            }
          >
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-lg font-bold">₦{total.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Biggest Cost Driver</p>
            <p className="text-lg font-bold capitalize">{topCategory?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">
              ₦{(topCategory?.amount || 0).toLocaleString()} ({(topCategory?.pct || 0).toFixed(1)}%)
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Contributors</p>
            <p className="text-lg font-bold">{byRecorder.length}</p>
            <p className="text-xs text-muted-foreground">{expenses.length} entries</p>
          </div>
        </div>

        {/* Category chart */}
        <div>
          <p className="text-xs font-semibold mb-2">Expenses by Category</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="amount" nameKey="name" outerRadius={80} label={(d: any) => `${d.name} ${d.pct.toFixed(0)}%`}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="hidden sm:table-cell">Entries</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCategory.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium capitalize">{c.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{c.count}</TableCell>
                  <TableCell className="text-right font-semibold">₦{c.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{c.pct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Recorder breakdown */}
        <div>
          <p className="text-xs font-semibold mb-2">Spend by Recorder</p>
          <div className="h-48 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRecorder} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `₦${Number(v).toLocaleString()}`} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {byRecorder.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {byRecorder.map((r) => (
              <div key={r.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">
                    ₦{r.amount.toLocaleString()} • {r.pct.toFixed(1)}% • {r.count} {r.count === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <Progress value={r.pct} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
