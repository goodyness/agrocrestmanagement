import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LogOut, Sprout, Plus, TrendingUp, AlertCircle, Package, UserCircle, 
  Egg, ShoppingCart, Skull, BarChart3, ClipboardCheck, Landmark, Wallet,
  Calendar, Clock
} from "lucide-react";
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
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

interface WorkerDashboardProps {
  user: User | null;
}

const ITEMS_PER_PAGE = 10;

const WorkerDashboard = ({ user }: WorkerDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [todayProduction, setTodayProduction] = useState({ crates: 0, pieces: 0 });
  const [todayMortality, setTodayMortality] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [weekProduction, setWeekProduction] = useState({ crates: 0, pieces: 0 });
  const [livestockData, setLivestockData] = useState<any[]>([]);
  const [feedData, setFeedData] = useState<any[]>([]);
  const [recentProduction, setRecentProduction] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<any[]>([]);

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

  const userBranchId = userProfile?.branch_id || null;
  const cleaningSchedule = useCleaningSchedule(userBranchId);

  const productionPagination = usePagination({ totalItems: recentProduction.length, itemsPerPage: ITEMS_PER_PAGE });
  const salesPagination = usePagination({ totalItems: recentSales.length, itemsPerPage: ITEMS_PER_PAGE });
  
  useEffect(() => {
    if (userProfile !== undefined) {
      fetchDashboardData(userBranchId);
    }
  }, [userProfile, userBranchId]);

  const fetchDashboardData = async (branchId: string | null) => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Today's production
    let productionQuery = supabase.from("daily_production").select("crates, pieces").eq("date", today);
    if (branchId) productionQuery = productionQuery.eq("branch_id", branchId);
    const { data: productionData } = await productionQuery;
    if (productionData && productionData.length > 0) {
      const totals = productionData.reduce((acc, curr) => ({ crates: acc.crates + curr.crates, pieces: acc.pieces + curr.pieces }), { crates: 0, pieces: 0 });
      setTodayProduction(totals);
    } else { setTodayProduction({ crates: 0, pieces: 0 }); }

    // Week's production
    let weekProdQuery = supabase.from("daily_production").select("crates, pieces").gte("date", weekAgo);
    if (branchId) weekProdQuery = weekProdQuery.eq("branch_id", branchId);
    const { data: weekProdData } = await weekProdQuery;
    if (weekProdData) {
      const totals = weekProdData.reduce((acc, curr) => ({ crates: acc.crates + curr.crates, pieces: acc.pieces + curr.pieces }), { crates: 0, pieces: 0 });
      setWeekProduction(totals);
    }

    // Today's mortality
    let mortalityQuery = supabase.from("mortality_records").select("quantity_dead").eq("date", today);
    if (branchId) mortalityQuery = mortalityQuery.eq("branch_id", branchId);
    const { data: mortalityData } = await mortalityQuery;
    setTodayMortality(mortalityData?.reduce((acc, curr) => acc + curr.quantity_dead, 0) || 0);

    // Today's sales
    let salesQuery = supabase.from("sales_records").select("total_amount").eq("date", today);
    if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);
    const { data: salesData } = await salesQuery;
    setTodaySales(salesData?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0);

    // Pending deliveries
    let pendingQuery = supabase.from("sales_records").select("*").eq("delivery_status", "preorder").order("date", { ascending: false });
    if (branchId) pendingQuery = pendingQuery.eq("branch_id", branchId);
    const { data: pendingData } = await pendingQuery;
    setPendingDeliveries(pendingData || []);

    // Livestock, Feed, Production history, Sales history
    const [livestock, feed, prodRecords, salesRecords] = await Promise.all([
      (async () => {
        let q = supabase.from("livestock_census").select("*, livestock_categories(name)").order("created_at", { ascending: false });
        if (branchId) q = q.eq("branch_id", branchId);
        return (await q).data || [];
      })(),
      (async () => {
        let q = supabase.from("feed_inventory").select("*, feed_types(feed_name, unit_type)").order("updated_at", { ascending: false });
        if (branchId) q = q.eq("branch_id", branchId);
        return (await q).data || [];
      })(),
      (async () => {
        let q = supabase.from("daily_production").select("*").order("date", { ascending: false }).limit(50);
        if (branchId) q = q.eq("branch_id", branchId);
        return (await q).data || [];
      })(),
      (async () => {
        let q = supabase.from("sales_records").select("*").order("date", { ascending: false }).limit(50);
        if (branchId) q = q.eq("branch_id", branchId);
        return (await q).data || [];
      })(),
    ]);
    
    setLivestockData(livestock);
    setFeedData(feed);
    setRecentProduction(prodRecords);
    setRecentSales(salesRecords);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
  };

  const handleRefresh = () => fetchDashboardData(userBranchId);

  const isSuspended = userProfile?.is_suspended;

  const paginatedProduction = recentProduction.slice(productionPagination.paginatedRange.startIndex, productionPagination.paginatedRange.endIndex);
  const paginatedSales = recentSales.slice(salesPagination.paginatedRange.startIndex, salesPagination.paginatedRange.endIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
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
                <p className="text-sm text-muted-foreground">Welcome, {userProfile?.name || "Worker"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
                <UserCircle className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Profile</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
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
        {user && <WorkerReviewNotification userId={user.id} />}

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Egg className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Today's Eggs</span>
              </div>
              <div className="text-2xl font-bold">{todayProduction.crates}</div>
              <p className="text-xs text-muted-foreground">{todayProduction.pieces} pcs</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Skull className="h-4 w-4 text-destructive" />
                <span className="text-xs font-medium text-muted-foreground">Mortality</span>
              </div>
              <div className="text-2xl font-bold">{todayMortality}</div>
              <p className="text-xs text-muted-foreground">birds today</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-muted-foreground">Sales</span>
              </div>
              <div className="text-2xl font-bold">₦{todaySales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">today</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium text-muted-foreground">Week Eggs</span>
              </div>
              <div className="text-2xl font-bold">{weekProduction.crates}</div>
              <p className="text-xs text-muted-foreground">{weekProduction.pieces} pcs</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-warning" />
                <span className="text-xs font-medium text-muted-foreground">Pending</span>
              </div>
              <div className="text-2xl font-bold">{pendingDeliveries.length}</div>
              <p className="text-xs text-muted-foreground">deliveries</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="overview" className="flex items-center gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="record" className="flex items-center gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Plus className="h-3.5 w-3.5" />
              <span>Record</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="production" className="flex items-center gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Production</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Sales</span>
            </TabsTrigger>
            <TabsTrigger value="salary" className="flex items-center gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wallet className="h-3.5 w-3.5" />
              <span>Salary</span>
            </TabsTrigger>
            <TabsTrigger value="farm" className="flex items-center gap-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Landmark className="h-3.5 w-3.5" />
              <span>Info</span>
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <CleaningStatusCard
              nextCleaningDate={cleaningSchedule.nextCleaningDate}
              daysUntilCleaning={cleaningSchedule.daysUntilCleaning}
              isCleaningDay={cleaningSchedule.isCleaningDay}
              isCleaningCompleted={cleaningSchedule.isCleaningCompleted}
              tasks={cleaningSchedule.tasks}
              onMarkComplete={cleaningSchedule.markCleaningComplete}
            />
            
            {/* Pending Deliveries */}
            {pendingDeliveries.length > 0 && (
              <Card className="border-warning/30 bg-warning/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-5 w-5 text-warning" />
                    Pending Deliveries ({pendingDeliveries.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingDeliveries.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-2 bg-background rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{order.buyer_name || "Customer"}</span>
                          <span className="text-muted-foreground ml-2">
                            {order.quantity} {order.unit} {order.product_name}
                          </span>
                        </div>
                        <Badge variant="outline">₦{Number(order.total_amount).toLocaleString()}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Livestock Census */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sprout className="h-4 w-4 text-primary" />
                    Livestock Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {livestockData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No livestock data</p>
                    ) : (
                      livestockData.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-2.5 bg-muted/30 rounded-lg">
                          <span className="font-medium text-sm">{item.livestock_categories?.name}</span>
                          <div className="text-right">
                            <span className="text-lg font-bold">{item.updated_count}</span>
                            <span className="text-xs text-muted-foreground ml-1">/ {item.total_count}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Feed Inventory */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Feed Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {feedData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No feed data</p>
                    ) : (
                      feedData.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-2.5 bg-muted/30 rounded-lg">
                          <span className="font-medium text-sm">{item.feed_types?.feed_name}</span>
                          <Badge variant={Number(item.quantity_in_stock) < 5 ? "destructive" : "secondary"}>
                            {Number(item.quantity_in_stock).toFixed(0)} {item.unit}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RECORD TAB - Quick Actions */}
          <TabsContent value="record" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-5 w-5 text-primary" />
                  Record Activities
                </CardTitle>
                <CardDescription>Tap to record daily farm activities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </TabsContent>

          {/* TASKS TAB */}
          <TabsContent value="tasks" className="space-y-4 mt-4">
            {user && <DailyTaskChecklist userId={user.id} branchId={userBranchId} />}
          </TabsContent>

          {/* PRODUCTION TAB */}
          <TabsContent value="production" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Production History</CardTitle>
                <CardDescription>Showing {paginatedProduction.length} of {recentProduction.length} records</CardDescription>
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
                      {paginatedProduction.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">No records</TableCell>
                        </TableRow>
                      ) : (
                        paginatedProduction.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{new Date(record.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">{record.crates}</TableCell>
                            <TableCell className="text-right">{record.pieces}</TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">{record.comment || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={productionPagination.currentPage}
                  totalPages={productionPagination.totalPages}
                  onPageChange={productionPagination.goToPage}
                  getPageNumbers={productionPagination.getPageNumbers}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALES TAB */}
          <TabsContent value="sales" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales History</CardTitle>
                <CardDescription>Showing {paginatedSales.length} of {recentSales.length} records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Buyer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">No records</TableCell>
                        </TableRow>
                      ) : (
                        paginatedSales.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{new Date(record.date).toLocaleDateString()}</TableCell>
                            <TableCell>{record.product_name}</TableCell>
                            <TableCell className="text-right">{record.quantity} {record.unit}</TableCell>
                            <TableCell className="text-right font-semibold">₦{Number(record.total_amount).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={record.delivery_status === 'delivered' ? 'default' : 'outline'} className="text-xs">
                                {record.delivery_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">{record.buyer_name || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={salesPagination.currentPage}
                  totalPages={salesPagination.totalPages}
                  onPageChange={salesPagination.goToPage}
                  getPageNumbers={salesPagination.getPageNumbers}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALARY TAB */}
          <TabsContent value="salary" className="space-y-4 mt-4">
            {user && <WorkerSalarySection userId={user.id} />}
          </TabsContent>

          {/* FARM INFO TAB */}
          <TabsContent value="farm" className="space-y-4 mt-4">
            <FarmAccountsSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default WorkerDashboard;
