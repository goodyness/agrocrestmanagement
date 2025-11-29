import { User } from "@supabase/supabase-js";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Sprout, BarChart3, Package, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./admin/OverviewTab";
import LivestockTab from "./admin/LivestockTab";
import FeedTab from "./admin/FeedTab";
import ProductionTab from "./admin/ProductionTab";
import SalesTab from "./admin/SalesTab";
import ExpensesTab from "./admin/ExpensesTab";

interface AdminDashboardProps {
  user: User | null;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [activeTab, setActiveTab] = useState("overview");

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
              <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-auto p-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="livestock" className="flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              <span className="hidden sm:inline">Livestock</span>
            </TabsTrigger>
            <TabsTrigger value="feed" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="production" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Production</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Sales</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="livestock" className="space-y-4">
            <LivestockTab />
          </TabsContent>

          <TabsContent value="feed" className="space-y-4">
            <FeedTab />
          </TabsContent>

          <TabsContent value="production" className="space-y-4">
            <ProductionTab />
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            <SalesTab />
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <ExpensesTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;