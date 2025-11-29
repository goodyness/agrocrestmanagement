import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Sprout, Plus, TrendingUp, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";
import AddMortalityDialog from "./worker/AddMortalityDialog";
import AddProductionDialog from "./worker/AddProductionDialog";
import AddSalesDialog from "./worker/AddSalesDialog";

interface WorkerDashboardProps {
  user: User | null;
}

const WorkerDashboard = ({ user }: WorkerDashboardProps) => {
  const [todayProduction, setTodayProduction] = useState({ crates: 0, pieces: 0 });
  const [todayMortality, setTodayMortality] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [livestockData, setLivestockData] = useState<any[]>([]);
  const [feedData, setFeedData] = useState<any[]>([]);

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
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Agrocrest Farm</h1>
              <p className="text-sm text-muted-foreground">Worker Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Worker</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Record daily farm activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AddProductionDialog onSuccess={fetchDashboardData} />
              <AddMortalityDialog onSuccess={fetchDashboardData} />
              <AddSalesDialog onSuccess={fetchDashboardData} />
            </div>
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Today's Production
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {todayProduction.crates} crates
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {todayProduction.pieces} pieces
              </p>
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
              <div className="text-2xl font-bold text-foreground">{todayMortality}</div>
              <p className="text-xs text-muted-foreground mt-1">birds lost</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-success" />
                Today's Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                ₦{todaySales.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">total revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Livestock Census */}
        <Card>
          <CardHeader>
            <CardTitle>Livestock Census</CardTitle>
            <CardDescription>Current livestock counts (Read Only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {livestockData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No livestock data available</p>
              ) : (
                livestockData.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium text-foreground">
                      {item.livestock_categories?.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Current: {item.updated_count} (Initial: {item.total_count})
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feed Availability */}
        <Card>
          <CardHeader>
            <CardTitle>Feed Availability</CardTitle>
            <CardDescription>Current feed stock levels (Read Only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feed data available</p>
              ) : (
                feedData.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium text-foreground">
                      {item.feed_types?.feed_name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.quantity_in_stock} {item.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default WorkerDashboard;