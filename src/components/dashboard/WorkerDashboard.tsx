import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
import { useCleaningSchedule } from "@/hooks/useCleaningSchedule";

interface WorkerDashboardProps {
  user: User | null;
}

const WorkerDashboard = ({ user }: WorkerDashboardProps) => {
  const navigate = useNavigate();
  const cleaningSchedule = useCleaningSchedule();
  const [todayProduction, setTodayProduction] = useState({ crates: 0, pieces: 0 });
  const [todayMortality, setTodayMortality] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [livestockData, setLivestockData] = useState<any[]>([]);
  const [feedData, setFeedData] = useState<any[]>([]);
  const [recentProduction, setRecentProduction] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Fetch today's production
    const { data: productionData } = await supabase
      .from("daily_production")
      .select("crates, pieces")
      .eq("date", today);

    if (productionData && productionData.length > 0) {
      const totals = productionData.reduce(
        (acc, curr) => ({
          crates: acc.crates + curr.crates,
          pieces: acc.pieces + curr.pieces,
        }),
        { crates: 0, pieces: 0 }
      );
      setTodayProduction(totals);
    }

    // Fetch today's mortality
    const { data: mortalityData } = await supabase
      .from("mortality_records")
      .select("quantity_dead")
      .eq("date", today);

    if (mortalityData) {
      const total = mortalityData.reduce((acc, curr) => acc + curr.quantity_dead, 0);
      setTodayMortality(total);
    }

    // Fetch today's sales
    const { data: salesData } = await supabase
      .from("sales_records")
      .select("total_amount")
      .eq("date", today);

    if (salesData) {
      const total = salesData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      setTodaySales(total);
    }

    // Fetch livestock census
    const { data: livestock } = await supabase
      .from("livestock_census")
      .select("*, livestock_categories(name)")
      .order("created_at", { ascending: false });

    setLivestockData(livestock || []);

    // Fetch feed inventory
    const { data: feed } = await supabase
      .from("feed_inventory")
      .select("*, feed_types(feed_name, unit_type)")
      .order("updated_at", { ascending: false });

    setFeedData(feed || []);

    // Fetch last 10 days production
    const { data: productionRecords } = await supabase
      .from("daily_production")
      .select("*")
      .order("date", { ascending: false })
      .limit(10);

    setRecentProduction(productionRecords || []);

    // Fetch last 10 days sales
    const { data: salesRecords } = await supabase
      .from("sales_records")
      .select("*")
      .order("date", { ascending: false })
      .limit(10);

    setRecentSales(salesRecords || []);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
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
      <CleaningReminderPopup
        isCleaningDay={cleaningSchedule.isCleaningDay}
        isReminderDay={cleaningSchedule.isReminderDay}
        isCleaningCompleted={cleaningSchedule.isCleaningCompleted}
        tasks={cleaningSchedule.tasks}
        nextCleaningDate={cleaningSchedule.nextCleaningDate}
        onMarkComplete={cleaningSchedule.markCleaningComplete}
      />

      <main className="container mx-auto px-4 lg:px-6 py-6 space-y-6">
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
              <AddProductionDialog onSuccess={fetchDashboardData} />
              <AddMortalityDialog onSuccess={fetchDashboardData} />
              <AddSalesDialog onSuccess={fetchDashboardData} />
              <AddFeedConsumptionDialog user={user!} onSuccess={fetchDashboardData} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <BulkProductionDialog onSuccess={fetchDashboardData} />
              <BulkMortalityDialog onSuccess={fetchDashboardData} />
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
                        <div className="text-xs text-muted-foreground">Initial: {item.total_count}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Feed Availability */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Feed Inventory</CardTitle>
              <CardDescription>Current stock levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {feedData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No feed data available</p>
                ) : (
                  feedData.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                      <span className="font-medium text-foreground">
                        {item.feed_types?.feed_name}
                      </span>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${item.quantity_in_stock < 50 ? 'text-destructive' : 'text-foreground'}`}>
                          {item.quantity_in_stock}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.unit}</div>
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