import { User } from "@supabase/supabase-js";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Sprout, BarChart3, Package, TrendingUp, DollarSign, Activity, FileText, Users as UsersIcon, UserCircle, Calculator, Syringe, Heart, StickyNote, Building2, Brush, Scale, Truck, Users, ClipboardCheck, PawPrint, AlertCircle, Landmark, Wallet, Stethoscope, Bot, Egg } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./admin/OverviewTab";
import LivestockTab from "./admin/LivestockTab";
import LivestockIntakeTab from "./admin/livestock/LivestockIntakeTab";
import FeedTab from "./admin/FeedTab";
import ProductionTab from "./admin/ProductionTab";
import SalesTab from "./admin/SalesTab";
import ExpensesTab from "./admin/ExpensesTab";
import ActivityTab from "./admin/ActivityTab";
import ReportsTab from "./admin/ReportsTab";
import UsersTab from "./admin/UsersTab";
import CostPerBirdAnalytics from "./admin/CostPerBirdAnalytics";
import VaccinationTab from "./admin/VaccinationTab";
import CleaningManagementTab from "./admin/CleaningManagementTab";
import BalancingTab from "./admin/BalancingTab";
import { HealthDashboard } from "./admin/HealthDashboard";
import { NotesTab } from "./admin/NotesTab";
import { BranchSelector } from "./BranchSelector";
import { useBranch } from "@/contexts/BranchContext";
import { WorkerBranchAssignment } from "./admin/WorkerBranchAssignment";
import BranchManagementTab from "./admin/BranchManagementTab";
import SuppliersTab from "./admin/SuppliersTab";
import CustomersTab from "./admin/CustomersTab";
import WorkerReviewsTab from "./admin/WorkerReviewsTab";
import FinanceTab from "./admin/FinanceTab";
import WorkerSalaryTab from "./admin/WorkerSalaryTab";
import FarmClinicTab from "./admin/FarmClinicTab";
import AiFarmAdvisorTab from "./admin/AiFarmAdvisorTab";
import EggGradingTab from "./admin/EggGradingTab";

interface AdminDashboardProps {
  user: User | null;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const { currentBranchId, currentBranch, branches, setCurrentBranchId } = useBranch();

  const switchToAbeokuta = () => {
    const abeokuta = branches.find(b => b.name === "Abeokuta");
    if (abeokuta) {
      setCurrentBranchId(abeokuta.id);
      toast.success("Switched to Abeokuta branch");
    } else {
      toast.error("Abeokuta branch not found");
    }
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
                <p className="text-sm text-muted-foreground">Admin Dashboard - {currentBranch?.name || "All Branches"}</p>
              </div>
            </div>
            <BranchSelector />
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="text-right flex-1 sm:flex-initial">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/farm-summary")}>
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Summary</span>
              </Button>
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

      <main className="container mx-auto px-4 lg:px-6 py-6 space-y-6">
        {!currentBranchId && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Will you like to switch to Abeokuta branch?</p>
              </div>
              <Button size="sm" onClick={switchToAbeokuta}>Yes, Switch to Abeokuta</Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col gap-4">
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
              <TabsTrigger value="cleaning" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Brush className="h-4 w-4" />
                <span className="hidden sm:inline">Cleaning</span>
              </TabsTrigger>
              <TabsTrigger value="balancing" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Scale className="h-4 w-4" />
                <span className="hidden sm:inline">Balancing</span>
              </TabsTrigger>
              <TabsTrigger value="branches" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Branches</span>
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Truck className="h-4 w-4" />
                <span className="hidden sm:inline">Suppliers</span>
              </TabsTrigger>
              <TabsTrigger value="customers" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Customers</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Reviews</span>
              </TabsTrigger>
              <TabsTrigger value="intake" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <PawPrint className="h-4 w-4" />
                <span className="hidden sm:inline">Intake</span>
              </TabsTrigger>
              <TabsTrigger value="finance" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Landmark className="h-4 w-4" />
                <span className="hidden sm:inline">Finance</span>
              </TabsTrigger>
              <TabsTrigger value="salary" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Salary</span>
              </TabsTrigger>
              <TabsTrigger value="clinic" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Stethoscope className="h-4 w-4" />
                <span className="hidden sm:inline">Clinic</span>
              </TabsTrigger>
              <TabsTrigger value="ai-advisor" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">AI Advisor</span>
              </TabsTrigger>
              <TabsTrigger value="egg-grading" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Egg className="h-4 w-4" />
                <span className="hidden sm:inline">Egg Grading</span>
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

          <TabsContent value="cleaning" className="space-y-4">
            <CleaningManagementTab />
          </TabsContent>

          <TabsContent value="balancing" className="space-y-4">
            <BalancingTab />
          </TabsContent>

          <TabsContent value="branches" className="space-y-4">
            <BranchManagementTab />
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <SuppliersTab />
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <WorkerReviewsTab />
          </TabsContent>

          <TabsContent value="intake" className="space-y-4">
            <LivestockIntakeTab />
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <FinanceTab />
          </TabsContent>

          <TabsContent value="salary" className="space-y-4">
            <WorkerSalaryTab />
          </TabsContent>

          <TabsContent value="clinic" className="space-y-4">
            <FarmClinicTab />
          </TabsContent>

          <TabsContent value="ai-advisor" className="space-y-4">
            <AiFarmAdvisorTab />
          </TabsContent>

          <TabsContent value="egg-grading" className="space-y-4">
            <EggGradingTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;