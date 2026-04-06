import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Sprout, Plus, TrendingUp, AlertCircle, Package, UserCircle } from "lucide-react";
import { toast } from "sonner";
import AddMortalityDialog from "./worker/AddMortalityDialog";
import AddProductionDialog from "./worker/AddProductionDialog";
import AddSalesDialog from "./worker/AddSalesDialog";
import AddFeedConsumptionDialog from "./worker/AddFeedConsumptionDialog";
import BulkMortalityDialog from "./worker/BulkMortalityDialog";
import BulkProductionDialog from "./worker/BulkProductionDialog";
import CleaningReminderPopup from "./worker/CleaningReminderPopup";
import CleaningStatusCard from "./worker/CleaningStatusCard";
import WorkerReviewNotification from "./worker/WorkerReviewNotification";
import SuspensionOverlay from "./SuspensionOverlay";
import FarmAccountsSection from "./worker/FarmAccountsSection";
import WorkerSalarySection from "./worker/WorkerSalarySection";
import { useCleaningSchedule } from "@/hooks/useCleaningSchedule";
import { BranchSelectionPrompt } from "./worker/BranchSelectionPrompt";
import DailyTaskChecklist from "./worker/DailyTaskChecklist";

interface WorkerDashboardProps {
  user: User | null;
}

const WorkerDashboard = ({ user }: WorkerDashboardProps) => {
  const navigate = useNavigate();
  const [todayProduction, setTodayProduction] = useState({ crates: 0, pieces: 0 });
  const [todayMortality, setTodayMortality] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [livestockData, setLivestockData] = useState<any[]>([]);
  const [feedData, setFeedData] = useState<any[]>([]);
  const [recentProduction, setRecentProduction] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  // Fetch user's profile including suspension status
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-full", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("branch_id, name, is_suspended, suspended_at, suspended_reason")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Use the user's branch for cleaning schedule
  const userBranchId = userProfile?.branch_id || null;
  const cleaningSchedule = useCleaningSchedule(userBranchId);
  
  useEffect(() => {
    if (userProfile !== undefined) {
      fetchDashboardData(userBranchId);
    }
  }, [userProfile, userBranchId]);

  const fetchDashboardData = async (branchId: string | null) => {
    const today = new Date().toISOString().split('T')[0];

    // Fetch today's production (filtered by branch)
    let productionQuery = supabase
      .from("daily_production")
      .select("crates, pieces")
      .eq("date", today);
    if (branchId) productionQuery = productionQuery.eq("branch_id", branchId);
    const { data: productionData } = await productionQuery;

    if (productionData && productionData.length > 0) {
      const totals = productionData.reduce(
        (acc, curr) => ({
          crates: acc.crates + curr.crates,
          pieces: acc.pieces + curr.pieces,
        }),
        { crates: 0, pieces: 0 }
      );
      setTodayProduction(totals);
    } else {
      setTodayProduction({ crates: 0, pieces: 0 });
    }

    // Fetch today's mortality (filtered by branch)
    let mortalityQuery = supabase
      .from("mortality_records")
      .select("quantity_dead")
      .eq("date", today);
    if (branchId) mortalityQuery = mortalityQuery.eq("branch_id", branchId);
    const { data: mortalityData } = await mortalityQuery;

    if (mortalityData) {
      const total = mortalityData.reduce((acc, curr) => acc + curr.quantity_dead, 0);
      setTodayMortality(total);
    } else {
      setTodayMortality(0);
    }

    // Fetch today's sales (filtered by branch)
    let salesQuery = supabase
      .from("sales_records")
      .select("total_amount")
      .eq("date", today);
    if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);
    const { data: salesData } = await salesQuery;

    if (salesData) {
      const total = salesData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      setTodaySales(total);
    } else {
      setTodaySales(0);
    }

    // Fetch livestock census (filtered by branch)
    let livestockQuery = supabase
      .from("livestock_census")
      .select("*, livestock_categories(name)")
      .order("created_at", { ascending: false });
    if (branchId) livestockQuery = livestockQuery.eq("branch_id", branchId);
    const { data: livestock } = await livestockQuery;

    setLivestockData(livestock || []);

    // Fetch feed inventory (filtered by branch)
    let feedQuery = supabase
      .from("feed_inventory")
      .select("*, feed_types(feed_name, unit_type)")
      .order("updated_at", { ascending: false });
    if (branchId) feedQuery = feedQuery.eq("branch_id", branchId);
    const { data: feed } = await feedQuery;

    setFeedData(feed || []);

    // Fetch last 10 days production (filtered by branch)
    let recentProductionQuery = supabase
      .from("daily_production")
      .select("*")
      .order("date", { ascending: false })
      .limit(10);
    if (branchId) recentProductionQuery = recentProductionQuery.eq("branch_id", branchId);
    const { data: productionRecords } = await recentProductionQuery;

    setRecentProduction(productionRecords || []);

    // Fetch last 10 days sales (filtered by branch)
    let recentSalesQuery = supabase
      .from("sales_records")
      .select("*")
      .order("date", { ascending: false })
      .limit(10);
    if (branchId) recentSalesQuery = recentSalesQuery.eq("branch_id", branchId);
    const { data: salesRecords } = await recentSalesQuery;

    setRecentSales(salesRecords || []);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    }
  };

  // Wrapper for onSuccess callbacks
  const handleRefresh = () => {
    fetchDashboardData(userBranchId);
  };

  // Check if user is suspended
  const isSuspended = userProfile?.is_suspended;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Suspension Overlay */}
      {isSuspended && userProfile && (
        <SuspensionOverlay
          userName={userProfile.name || "User"}
          userEmail={user?.email || ""}
          reason={userProfile.suspended_reason || "No reason provided"}
          suspendedAt={userProfile.suspended_at || new Date().toISOString()}
        />
      )}

      <header className="border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Sprout className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Agrocrest Farm</h1>
                <p className="text-sm text-muted-foreground">Worker Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="text-right flex-1 sm:flex-initial">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Worker</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
                <UserCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Profile</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Branch Selection Prompt for workers without branch */}
      {user && userProfile !== undefined && !isSuspended && (
        <BranchSelectionPrompt userId={user.id} userBranchId={userProfile?.branch_id || null} />
      )}
      
      {!isSuspended && (
        <CleaningReminderPopup
          isCleaningDay={cleaningSchedule.isCleaningDay}
          isReminderDay={cleaningSchedule.isReminderDay}
          isCleaningCompleted={cleaningSchedule.isCleaningCompleted}
          tasks={cleaningSchedule.tasks}
          nextCleaningDate={cleaningSchedule.nextCleaningDate}
          onMarkComplete={cleaningSchedule.markCleaningComplete}
        />
      )}

      <main className="container mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Worker Review Notification */}
        {user && <WorkerReviewNotification userId={user.id} />}
        {/* Worker Salary Tracking */}
        {user && <WorkerSalarySection userId={user.id} />}
        {/* Farm Bank Accounts */}
        <FarmAccountsSection />
        {/* Quick Actions */}
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Record daily farm activities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <AddProductionDialog onSuccess={handleRefresh} />
              <AddMortalityDialog onSuccess={handleRefresh} branchId={userBranchId} />
              <AddSalesDialog onSuccess={handleRefresh} />
              <AddFeedConsumptionDialog user={user!} onSuccess={handleRefresh} branchId={userBranchId} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <BulkProductionDialog onSuccess={handleRefresh} />
              <BulkMortalityDialog onSuccess={handleRefresh} />
            </div>
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CleaningStatusCard
            nextCleaningDate={cleaningSchedule.nextCleaningDate}
            daysUntilCleaning={cleaningSchedule.daysUntilCleaning}
            isCleaningDay={cleaningSchedule.isCleaningDay}
            isCleaningCompleted={cleaningSchedule.isCleaningCompleted}
            tasks={cleaningSchedule.tasks}
            onMarkComplete={cleaningSchedule.markCleaningComplete}
          />
          <Card className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                Today's Production
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {todayProduction.crates}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                crates ({todayProduction.pieces} pieces)
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
                Today's Mortality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{todayMortality}</div>
              <p className="text-xs text-muted-foreground mt-1">birds lost</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <Package className="h-4 w-4 text-success" />
                </div>
                Today's Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                ₦{todaySales.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">total revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Production Records */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Recent Production (Last 10 Days)</CardTitle>
            <CardDescription>Daily egg production records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Crates</TableHead>
                    <TableHead className="text-right">Pieces</TableHead>
                    <TableHead className="hidden sm:table-cell">Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentProduction.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No production records yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentProduction.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">{record.crates}</TableCell>
                        <TableCell className="text-right">{record.pieces}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {record.comment || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales Records */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Recent Sales (Last 10 Days)</CardTitle>
            <CardDescription>Sales transaction history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Buyer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No sales records yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentSales.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{record.product_name}</TableCell>
                        <TableCell className="text-right">
                          {record.quantity} {record.unit}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ₦{Number(record.total_amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {record.buyer_name || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Livestock Census */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Livestock Census</CardTitle>
              <CardDescription>Current livestock counts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {livestockData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No livestock data available</p>
                ) : (
                  livestockData.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                      <span className="font-medium text-foreground">
                        {item.livestock_categories?.name}
                      </span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">{item.updated_count}</div>
                        <div className="text-xs text-muted-foreground">
                          Initial: {item.total_count}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Feed Inventory */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Feed Inventory</CardTitle>
              <CardDescription>Current feed stock levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {feedData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No feed inventory data</p>
                ) : (
                  feedData.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                      <span className="font-medium text-foreground">
                        {item.feed_types?.feed_name}
                      </span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          {item.quantity_in_stock} {item.unit}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default WorkerDashboard;
