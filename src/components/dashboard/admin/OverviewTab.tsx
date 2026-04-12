import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout, TrendingUp, AlertCircle, DollarSign, Package } from "lucide-react";
import FeedAnalyticsWidget from "./FeedAnalyticsWidget";
import AnomalyAlertsWidget from "./AnomalyAlertsWidget";
import BatchMilestoneAlerts from "./BatchMilestoneAlerts";
import LivestockInvestmentWidget from "./LivestockInvestmentWidget";
import AllBranchesSummary from "./AllBranchesSummary";
import WeatherWidget from "./WeatherWidget";
import HenDayProductionRate from "./HenDayProductionRate";
import BreakEvenCalculator from "./BreakEvenCalculator";
import SeasonalTrendAnalysis from "./SeasonalTrendAnalysis";
import InventoryExpiryTracker from "./InventoryExpiryTracker";
import InvoiceGenerator from "./InvoiceGenerator";
import VetVisitLog from "./VetVisitLog";
import { useBranch } from "@/contexts/BranchContext";
import { Separator } from "@/components/ui/separator";

const OverviewTab = () => {
  const { currentBranchId } = useBranch();
  const [branchLocation, setBranchLocation] = useState<string | null>(null);
  const [stats, setStats] = useState({
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

  useEffect(() => {
    fetchStats();
    fetchBranchLocation();
  }, [currentBranchId]);

  const fetchBranchLocation = async () => {
    if (!currentBranchId) {
      setBranchLocation(null);
      return;
    }
    const { data } = await supabase
      .from("branches")
      .select("location, name")
      .eq("id", currentBranchId)
      .maybeSingle();
    setBranchLocation(data?.location || data?.name || null);
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Total livestock
    let livestockQuery = supabase.from("livestock_census").select("updated_count");
    if (currentBranchId) livestockQuery = livestockQuery.eq("branch_id", currentBranchId);
    const { data: livestock } = await livestockQuery;
    const totalLivestock = livestock?.reduce((acc, curr) => acc + curr.updated_count, 0) || 0;

    // Today's production
    let productionQuery = supabase.from("daily_production").select("crates").eq("date", today);
    if (currentBranchId) productionQuery = productionQuery.eq("branch_id", currentBranchId);
    const { data: production } = await productionQuery;
    const todayProduction = production?.reduce((acc, curr) => acc + curr.crates, 0) || 0;

    // Today's mortality
    let mortalityQuery = supabase.from("mortality_records").select("quantity_dead").eq("date", today);
    if (currentBranchId) mortalityQuery = mortalityQuery.eq("branch_id", currentBranchId);
    const { data: mortality } = await mortalityQuery;
    const todayMortality = mortality?.reduce((acc, curr) => acc + curr.quantity_dead, 0) || 0;

    // Today's sales
    let todaySalesQuery = supabase.from("sales_records").select("total_amount").eq("date", today);
    if (currentBranchId) todaySalesQuery = todaySalesQuery.eq("branch_id", currentBranchId);
    const { data: todaySalesData } = await todaySalesQuery;
    const todaySales = todaySalesData?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;

    // Today's expenses
    let todayExpensesQuery = supabase.from("miscellaneous_expenses").select("amount").eq("date", today);
    if (currentBranchId) todayExpensesQuery = todayExpensesQuery.eq("branch_id", currentBranchId);
    const { data: todayExpensesData } = await todayExpensesQuery;
    const todayExpenses = todayExpensesData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    // Week's sales
    let weekSalesQuery = supabase.from("sales_records").select("total_amount").gte("date", weekAgo);
    if (currentBranchId) weekSalesQuery = weekSalesQuery.eq("branch_id", currentBranchId);
    const { data: weekSalesData } = await weekSalesQuery;
    const weekSales = weekSalesData?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;

    // Week's expenses
    let weekExpensesQuery = supabase.from("miscellaneous_expenses").select("amount").gte("date", weekAgo);
    if (currentBranchId) weekExpensesQuery = weekExpensesQuery.eq("branch_id", currentBranchId);
    const { data: weekExpensesData } = await weekExpensesQuery;
    const weekExpenses = weekExpensesData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    setStats({
      totalLivestock,
      todayProduction,
      todayMortality,
      todaySales,
      todayExpenses,
      profit: todaySales - todayExpenses,
      weekSales,
      weekExpenses,
      weekProfit: weekSales - weekExpenses,
    });
  };

  return (
    <div className="space-y-8">
      {/* All Branches Summary - shown when no specific branch is selected */}
      {!currentBranchId && (
        <>
          <AllBranchesSummary />
          <Separator className="my-8" />
        </>
      )}

      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {currentBranchId ? "Branch Overview" : "Global Dashboard Overview"}
        </h2>
        <p className="text-muted-foreground">
          {currentBranchId ? "Metrics for selected branch" : "Key metrics and performance indicators"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sprout className="h-4 w-4 text-primary" />
              Total Livestock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalLivestock}</div>
            <p className="text-xs text-muted-foreground mt-1">Current count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Today's Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.todayProduction}</div>
            <p className="text-xs text-muted-foreground mt-1">crates of eggs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Today's Mortality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.todayMortality}</div>
            <p className="text-xs text-muted-foreground mt-1">birds lost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-accent" />
              Today's Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{stats.todaySales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">total revenue</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              Today's Profit
            </CardTitle>
            <CardDescription>Sales - Expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₦{stats.profit.toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <p>Sales: ₦{stats.todaySales.toLocaleString()}</p>
              <p>Expenses: ₦{stats.todayExpenses.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              This Week's Sales
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              ₦{stats.weekSales.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              This Week's Profit
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.weekProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₦{stats.weekProfit.toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <p>Sales: ₦{stats.weekSales.toLocaleString()}</p>
              <p>Expenses: ₦{stats.weekExpenses.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly Alerts */}
      <div className="mt-6">
        <AnomalyAlertsWidget />
      </div>

      {/* Livestock Investment Widget */}
      <div className="mt-6">
        <LivestockInvestmentWidget />
      </div>

      {/* Batch Milestone Alerts */}
      <div className="mt-6">
        <BatchMilestoneAlerts />
      </div>

      {/* Weather Widget */}
      <div className="mt-6">
        <WeatherWidget branchLocation={branchLocation} />
      </div>

      {/* Hen-Day Production Rate & Break-Even */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <HenDayProductionRate />
        <BreakEvenCalculator />
      </div>

      {/* Seasonal Trends */}
      <div className="mt-6">
        <SeasonalTrendAnalysis />
      </div>

      {/* Inventory Expiry & Vet Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <InventoryExpiryTracker />
        <VetVisitLog />
      </div>

      {/* Invoice Generator */}
      <div className="mt-6">
        <InvoiceGenerator />
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Feed Analytics</h3>
        <FeedAnalyticsWidget />
      </div>
    </div>
  );
};

export default OverviewTab;
