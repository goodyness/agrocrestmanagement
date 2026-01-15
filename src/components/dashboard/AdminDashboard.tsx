import { User } from "@supabase/supabase-js";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Sprout, BarChart3, Package, TrendingUp, DollarSign, Activity, FileText, Users as UsersIcon, UserCircle, Calculator, Syringe, Heart, StickyNote, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./admin/OverviewTab";
import LivestockTab from "./admin/LivestockTab";
import FeedTab from "./admin/FeedTab";
import ProductionTab from "./admin/ProductionTab";
import SalesTab from "./admin/SalesTab";
import ExpensesTab from "./admin/ExpensesTab";
import ActivityTab from "./admin/ActivityTab";
import ReportsTab from "./admin/ReportsTab";
import UsersTab from "./admin/UsersTab";
import CostPerBirdAnalytics from "./admin/CostPerBirdAnalytics";
import VaccinationTab from "./admin/VaccinationTab";
import CleaningScheduleDialog from "./admin/dialogs/CleaningScheduleDialog";
import { HealthDashboard } from "./admin/HealthDashboard";
import { NotesTab } from "./admin/NotesTab";
import { BranchSelector } from "./BranchSelector";
import { useBranch } from "@/contexts/BranchContext";
import { WorkerBranchAssignment } from "./admin/WorkerBranchAssignment";
import BranchManagementTab from "./admin/BranchManagementTab";

interface AdminDashboardProps {
  user: User | null;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const { currentBranch } = useBranch();

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
                <p className="text-sm text-muted-foreground">Admin Dashboard - {currentBranch?.name || "All Branches"}</p>
              </div>
            </div>
            <BranchSelector />
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="text-right flex-1 sm:flex-initial">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
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

      <main className="container mx-auto px-4 lg:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <CleaningScheduleDialog onSuccess={() => {}} />
            </div>
            <TabsList className="w-full flex flex-wrap gap-2 h-auto p-1 bg-muted/50">
              <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="livestock" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Sprout className="h-4 w-4" />
                <span className="hidden sm:inline">Livestock</span>
              </TabsTrigger>
              <TabsTrigger value="health" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Health</span>
              </TabsTrigger>
              <TabsTrigger value="vaccination" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Syringe className="h-4 w-4" />
                <span className="hidden sm:inline">Vaccination</span>
              </TabsTrigger>
              <TabsTrigger value="feed" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Feed</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="production" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Production</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Sales</span>
              </TabsTrigger>
              <TabsTrigger value="expenses" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Expenses</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <StickyNote className="h-4 w-4" />
                <span className="hidden sm:inline">Notes</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <UsersIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Reports</span>
              </TabsTrigger>
              <TabsTrigger value="branches" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Branches</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="livestock" className="space-y-4">
            <LivestockTab />
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <HealthDashboard />
          </TabsContent>

          <TabsContent value="vaccination" className="space-y-4">
            <VaccinationTab />
          </TabsContent>

          <TabsContent value="feed" className="space-y-4">
            <FeedTab />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <CostPerBirdAnalytics />
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

          <TabsContent value="users" className="space-y-4">
            <UsersTab />
            <WorkerBranchAssignment />
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <NotesTab />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <ActivityTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsTab />
          </TabsContent>

          <TabsContent value="branches" className="space-y-4">
            <BranchManagementTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;