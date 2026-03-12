import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useBranch } from "@/contexts/BranchContext";
import BranchSelector from "@/components/dashboard/BranchSelector";
import {
  Egg, ArrowLeft, TrendingUp, TrendingDown, Package,
  DollarSign, Skull, Sprout, BarChart3, ShoppingCart, Warehouse
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const FarmSummary = () => {
  const navigate = useNavigate();
  const { currentBranchId } = useBranch();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProduction: 0,
    totalSold: 0,
    expectedOnFarm: 0,
    totalRevenue: 0,
    totalInvestment: 0,
    totalExpenses: 0,
    totalMortality: 0,
    totalBirds: 0,
    totalBatches: 0,
    feedCost: 0,
  });
  const [productionByMonth, setProductionByMonth] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      fetchSummary();
    };
    checkAuth();
  }, [currentBranchId]);

  const fetchSummary = async () => {
    setLoading(true);

    // Total egg production (all time) - in pieces
    let prodQuery = supabase.from("daily_production").select("crates, pieces, date");
    if (currentBranchId) prodQuery = prodQuery.eq("branch_id", currentBranchId);
    const { data: prodData } = await prodQuery;
    const totalProdPieces = prodData?.reduce((s, p) => s + (p.crates * 30) + p.pieces, 0) || 0;

    // Total eggs sold (product_type = 'eggs')
    let salesQuery = supabase.from("sales_records").select("quantity, unit, total_amount, date, product_type");
    if (currentBranchId) salesQuery = salesQuery.eq("branch_id", currentBranchId);
    const { data: salesData } = await salesQuery;

    const eggSales = salesData?.filter((s) => s.product_type === "eggs") || [];
    const totalSoldPieces = eggSales.reduce((s, sale) => {
      const qty = Number(sale.quantity);
      if (sale.unit === "crate" || sale.unit === "crates") return s + qty * 30;
      return s + qty;
    }, 0);
    const totalEggRevenue = eggSales.reduce((s, sale) => s + Number(sale.total_amount), 0);
    const totalAllRevenue = salesData?.reduce((s, sale) => s + Number(sale.total_amount), 0) || 0;

    // Expected eggs on farm = produced - sold
    const expectedOnFarm = totalProdPieces - totalSoldPieces;

    // Livestock batches
    let batchQuery = supabase.from("livestock_batches").select("quantity, current_quantity, total_cost, is_active");
    if (currentBranchId) batchQuery = batchQuery.eq("branch_id", currentBranchId);
    const { data: batchData } = await batchQuery;
    const activeBatches = batchData?.filter((b) => b.is_active) || [];
    const totalBirds = activeBatches.reduce((s, b) => s + b.current_quantity, 0);
    const totalPurchaseCost = batchData?.reduce((s, b) => s + Number(b.total_cost || 0), 0) || 0;

    // Total mortality
    let mortQuery = supabase.from("mortality_records").select("quantity_dead");
    if (currentBranchId) mortQuery = mortQuery.eq("branch_id", currentBranchId);
    const { data: mortData } = await mortQuery;
    const totalMortality = mortData?.reduce((s, m) => s + m.quantity_dead, 0) || 0;

    // Expenses
    let expQuery = supabase.from("miscellaneous_expenses").select("amount, expense_type");
    if (currentBranchId) expQuery = expQuery.eq("branch_id", currentBranchId);
    const { data: expData } = await expQuery;
    const totalExpenses = expData?.reduce((s, e) => s + Number(e.amount), 0) || 0;

    // Feed purchases
    let feedQuery = supabase.from("feed_purchases").select("total_cost");
    if (currentBranchId) feedQuery = feedQuery.eq("branch_id", currentBranchId);
    const { data: feedData } = await feedQuery;
    const feedCost = feedData?.reduce((s, f) => s + Number(f.total_cost), 0) || 0;

    const totalInvestment = totalPurchaseCost + totalExpenses + feedCost;

    setStats({
      totalProduction: totalProdPieces,
      totalSold: totalSoldPieces,
      expectedOnFarm,
      totalRevenue: totalAllRevenue,
      totalInvestment,
      totalExpenses,
      totalMortality,
      totalBirds,
      totalBatches: activeBatches.length,
      feedCost,
    });

    // Production by month
    const monthlyProd: Record<string, { produced: number; sold: number }> = {};
    prodData?.forEach((p) => {
      const month = p.date.slice(0, 7);
      if (!monthlyProd[month]) monthlyProd[month] = { produced: 0, sold: 0 };
      monthlyProd[month].produced += (p.crates * 30) + p.pieces;
    });
    eggSales.forEach((s) => {
      const month = s.date.slice(0, 7);
      if (!monthlyProd[month]) monthlyProd[month] = { produced: 0, sold: 0 };
      const qty = Number(s.quantity);
      monthlyProd[month].sold += (s.unit === "crate" || s.unit === "crates") ? qty * 30 : qty;
    });
    const sortedMonths = Object.keys(monthlyProd).sort();
    setProductionByMonth(
      sortedMonths.slice(-12).map((m) => ({
        month: new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        produced: monthlyProd[m].produced,
        sold: monthlyProd[m].sold,
        onFarm: monthlyProd[m].produced - monthlyProd[m].sold,
      }))
    );

    // Expense breakdown
    const expBreakdown: Record<string, number> = {};
    expData?.forEach((e) => {
      expBreakdown[e.expense_type] = (expBreakdown[e.expense_type] || 0) + Number(e.amount);
    });
    if (feedCost > 0) expBreakdown["Feed Purchases"] = feedCost;
    if (totalPurchaseCost > 0) expBreakdown["Livestock Purchase"] = totalPurchaseCost;
    setExpenseBreakdown(
      Object.entries(expBreakdown)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    );

    setLoading(false);
  };

  const expectedCrates = Math.floor(stats.expectedOnFarm / 30);
  const expectedPieces = stats.expectedOnFarm % 30;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Farm Summary</h1>
          <p className="text-sm text-muted-foreground">Complete overview of your farm operations</p>
        </div>
        <BranchSelector />
      </div>

      <Separator />

      {/* Expected Eggs on Farm - HERO CARD */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Egg className="h-6 w-6 text-primary" />
            Expected Eggs on Farm (Today)
          </CardTitle>
          <CardDescription>Based on total production minus total eggs sold</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">
                {expectedCrates} <span className="text-lg font-normal text-muted-foreground">crates</span>
                {expectedPieces > 0 && (
                  <span className="text-2xl ml-1">+ {expectedPieces} <span className="text-sm font-normal text-muted-foreground">pcs</span></span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ({stats.expectedOnFarm.toLocaleString()} pieces total)
              </p>
            </div>
            <div className="text-center border-l border-border pl-4">
              <p className="text-xs text-muted-foreground">Total Produced</p>
              <p className="text-2xl font-bold">{Math.floor(stats.totalProduction / 30).toLocaleString()} crates</p>
              <p className="text-xs text-muted-foreground">({stats.totalProduction.toLocaleString()} pieces)</p>
            </div>
            <div className="text-center border-l border-border pl-4">
              <p className="text-xs text-muted-foreground">Total Sold</p>
              <p className="text-2xl font-bold text-green-600">{Math.floor(stats.totalSold / 30).toLocaleString()} crates</p>
              <p className="text-xs text-muted-foreground">({stats.totalSold.toLocaleString()} pieces)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Sprout className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.totalBirds.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{stats.totalBatches} Active Batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold text-green-600">₦{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Warehouse className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">₦{stats.totalInvestment.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Investment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Skull className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-2xl font-bold text-destructive">{stats.totalMortality.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Mortality</p>
          </CardContent>
        </Card>
      </div>

      {/* P&L Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Profit & Loss Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 text-center">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">₦{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-destructive/10 text-center">
              <p className="text-xs text-muted-foreground">Total Spending</p>
              <p className="text-2xl font-bold text-destructive">₦{stats.totalInvestment.toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-lg text-center ${stats.totalRevenue - stats.totalInvestment >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
              <p className="text-xs text-muted-foreground">Net Position</p>
              <p className={`text-2xl font-bold ${stats.totalRevenue - stats.totalInvestment >= 0 ? "text-green-600" : "text-destructive"}`}>
                ₦{(stats.totalRevenue - stats.totalInvestment).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production vs Sales Chart */}
        {productionByMonth.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Egg Production vs Sales</CardTitle>
              <CardDescription>In pieces (last 12 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productionByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend />
                    <Bar dataKey="produced" fill="hsl(var(--primary))" name="Produced" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sold" fill="#22c55e" name="Sold" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expense Breakdown */}
        {expenseBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense Breakdown</CardTitle>
              <CardDescription>Where your money goes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {expenseBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend list */}
              <div className="mt-3 space-y-1">
                {expenseBreakdown.map((e, i) => (
                  <div key={e.name} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{e.name}</span>
                    </div>
                    <span className="font-medium">₦{e.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FarmSummary;
