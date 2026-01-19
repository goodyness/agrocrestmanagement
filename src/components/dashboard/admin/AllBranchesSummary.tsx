import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sprout, TrendingUp, AlertCircle, DollarSign, Building2 } from "lucide-react";

interface BranchStats {
  id: string;
  name: string;
  totalLivestock: number;
  todayProduction: number;
  todayMortality: number;
  todaySales: number;
  todayExpenses: number;
  profit: number;
}

const AllBranchesSummary = () => {
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [totals, setTotals] = useState({
    totalLivestock: 0,
    todayProduction: 0,
    todayMortality: 0,
    todaySales: 0,
    todayExpenses: 0,
    profit: 0,
    weekSales: 0,
    weekExpenses: 0,
    weekProfit: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllBranchesData();
  }, []);

  const fetchAllBranchesData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch all branches
    const { data: branches } = await supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!branches || branches.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch all data without branch filter
    const [
      { data: allLivestock },
      { data: allProduction },
      { data: allMortality },
      { data: allSales },
      { data: allExpenses },
      { data: weekSalesData },
      { data: weekExpensesData },
    ] = await Promise.all([
      supabase.from("livestock_census").select("branch_id, updated_count"),
      supabase.from("daily_production").select("branch_id, crates").eq("date", today),
      supabase.from("mortality_records").select("branch_id, quantity_dead").eq("date", today),
      supabase.from("sales_records").select("branch_id, total_amount").eq("date", today),
      supabase.from("miscellaneous_expenses").select("branch_id, amount").eq("date", today),
      supabase.from("sales_records").select("total_amount").gte("date", weekAgo),
      supabase.from("miscellaneous_expenses").select("amount").gte("date", weekAgo),
    ]);

    // Calculate stats per branch
    const stats: BranchStats[] = branches.map((branch) => {
      const branchLivestock = allLivestock?.filter(l => l.branch_id === branch.id) || [];
      const branchProduction = allProduction?.filter(p => p.branch_id === branch.id) || [];
      const branchMortality = allMortality?.filter(m => m.branch_id === branch.id) || [];
      const branchSales = allSales?.filter(s => s.branch_id === branch.id) || [];
      const branchExpenses = allExpenses?.filter(e => e.branch_id === branch.id) || [];

      const totalLivestock = branchLivestock.reduce((acc, curr) => acc + curr.updated_count, 0);
      const todayProduction = branchProduction.reduce((acc, curr) => acc + curr.crates, 0);
      const todayMortality = branchMortality.reduce((acc, curr) => acc + curr.quantity_dead, 0);
      const todaySales = branchSales.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      const todayExpenses = branchExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

      return {
        id: branch.id,
        name: branch.name,
        totalLivestock,
        todayProduction,
        todayMortality,
        todaySales,
        todayExpenses,
        profit: todaySales - todayExpenses,
      };
    });

    setBranchStats(stats);

    // Calculate combined totals
    const weekSales = weekSalesData?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;
    const weekExpenses = weekExpensesData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    setTotals({
      totalLivestock: stats.reduce((acc, s) => acc + s.totalLivestock, 0),
      todayProduction: stats.reduce((acc, s) => acc + s.todayProduction, 0),
      todayMortality: stats.reduce((acc, s) => acc + s.todayMortality, 0),
      todaySales: stats.reduce((acc, s) => acc + s.todaySales, 0),
      todayExpenses: stats.reduce((acc, s) => acc + s.todayExpenses, 0),
      profit: stats.reduce((acc, s) => acc + s.profit, 0),
      weekSales,
      weekExpenses,
      weekProfit: weekSales - weekExpenses,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">All Branches Summary</h2>
          <p className="text-muted-foreground">Combined metrics across all active branches</p>
        </div>
      </div>

      {/* Total summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sprout className="h-4 w-4 text-primary" />
              Total Livestock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totals.totalLivestock.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all branches</p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Today's Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totals.todayProduction.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">crates of eggs</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Today's Mortality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totals.todayMortality.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">birds lost</p>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-accent" />
              Today's Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{totals.todaySales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">total revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Profit cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              Today's Profit
            </CardTitle>
            <CardDescription>All branches combined</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totals.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₦{totals.profit.toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <p>Sales: ₦{totals.todaySales.toLocaleString()}</p>
              <p>Expenses: ₦{totals.todayExpenses.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              This Week's Sales
            </CardTitle>
            <CardDescription>Last 7 days (all branches)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              ₦{totals.weekSales.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              This Week's Profit
            </CardTitle>
            <CardDescription>Last 7 days (all branches)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totals.weekProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₦{totals.weekProfit.toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <p>Sales: ₦{totals.weekSales.toLocaleString()}</p>
              <p>Expenses: ₦{totals.weekExpenses.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Comparison
          </CardTitle>
          <CardDescription>Today's metrics by branch</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Livestock</TableHead>
                <TableHead className="text-right">Production</TableHead>
                <TableHead className="text-right">Mortality</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchStats.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="text-right">{branch.totalLivestock.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{branch.todayProduction}</TableCell>
                  <TableCell className="text-right">{branch.todayMortality}</TableCell>
                  <TableCell className="text-right">₦{branch.todaySales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₦{branch.todayExpenses.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium ${branch.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ₦{branch.profit.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totals.totalLivestock.toLocaleString()}</TableCell>
                <TableCell className="text-right">{totals.todayProduction}</TableCell>
                <TableCell className="text-right">{totals.todayMortality}</TableCell>
                <TableCell className="text-right">₦{totals.todaySales.toLocaleString()}</TableCell>
                <TableCell className="text-right">₦{totals.todayExpenses.toLocaleString()}</TableCell>
                <TableCell className={`text-right ${totals.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ₦{totals.profit.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AllBranchesSummary;
