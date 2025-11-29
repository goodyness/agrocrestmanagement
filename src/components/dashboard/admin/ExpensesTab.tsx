import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import AddExpenseDialog from "./dialogs/AddExpenseDialog";

const ExpensesTab = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from("miscellaneous_expenses")
      .select("*, profiles(name)")
      .order("date", { ascending: false })
      .limit(30);

    if (data) {
      setExpenses(data);
      const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
      setTotalExpenses(total);

      const breakdown = data.reduce((acc, curr) => {
        acc[curr.expense_type] = (acc[curr.expense_type] || 0) + Number(curr.amount);
        return acc;
      }, {} as Record<string, number>);
      setCategoryBreakdown(breakdown);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Expenses Management</h2>
          <p className="text-muted-foreground">Track all farm expenses</p>
        </div>
        <AddExpenseDialog onSuccess={fetchData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Expenses (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">from {expenses.length} expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₦{expenses.length > 0 ? Math.round(totalExpenses / expenses.length).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">per expense</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Expense Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {Object.keys(categoryBreakdown).length > 0
                ? Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0][0]
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Object.keys(categoryBreakdown).length > 0
                ? `₦${Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0][1].toLocaleString()}`
                : "No expenses"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
          <CardDescription>Last 30 days of expense records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No expense records yet
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{record.expense_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{record.description || "-"}</TableCell>
                    <TableCell className="font-medium">₦{Number(record.amount).toLocaleString()}</TableCell>
                    <TableCell>{record.profiles?.name || "Unknown"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesTab;