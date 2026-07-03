import { User } from "@supabase/supabase-js";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Sprout, BarChart3, UserCircle, AlertCircle } from "lucide-react";
import PartnersTab from "./admin/PartnersTab";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar, { AdminTabKey } from "./admin/AdminSidebar";
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
import ProductionForecast from "./admin/ProductionForecast";
import ProfitabilityHeatmap from "./admin/ProfitabilityHeatmap";
import CustomerOrdersSection from "./admin/CustomerOrdersSection";
import WeeklyReportButton from "./admin/WeeklyReportButton";
import ExpectedStockTab from "./admin/ExpectedStockTab";
import ExpectedProfitTab from "./admin/ExpectedProfitTab";
import InventoryPlusTab from "./admin/InventoryPlusTab";
import OperationsTab from "./admin/OperationsTab";
import CrackedEggsTab from "./admin/CrackedEggsTab";

interface AdminDashboardProps {
  user: User | null;
}

const TAB_TITLES: Record<AdminTabKey, string> = {
  overview: "Dashboard", activity: "Activity",
  intake: "Livestock Intake", livestock: "Livestock", vaccination: "Vaccination", clinic: "Farm Clinic", health: "Health",
  production: "Production", "egg-grading": "Egg Grading", "cracked-eggs": "Cracked Eggs",
  feed: "Feed", "inventory-plus": "Inventory+", "expected-stock": "Expected Stock",
  sales: "Sales", expenses: "Expenses", finance: "Finance", "expected-profit": "Expected Profit", salary: "Salary",
  users: "Users", partners: "Partners", withdrawals: "Withdrawals", complaints: "Complaints", reviews: "Reviews", suppliers: "Suppliers", customers: "Customers",
  cleaning: "Cleaning", operations: "Operations", balancing: "Balancing",
  reports: "Reports", notes: "Notes", "ai-advisor": "AI Advisor", analytics: "Cost Analytics",
  branches: "Branches",
};

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTabKey>("overview");
  const { currentBranchId, currentBranch, branches, setCurrentBranchId } = useBranch();

  const switchToAbeokuta = () => {
    const abeokuta = branches.find(b => b.name === "Abeokuta" || b.name.includes("Abeokuta"));
    if (abeokuta) {
      setCurrentBranchId(abeokuta.id);
      toast.success("Switched to Abeokuta branch");
    } else {
      toast.error("Abeokuta branch not found");
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
  };

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab />;
      case "activity": return <ActivityTab />;
      case "intake": return <LivestockIntakeTab />;
      case "livestock": return <LivestockTab />;
      case "vaccination": return <VaccinationTab />;
      case "clinic": return <FarmClinicTab />;
      case "health": return <HealthDashboard />;
      case "production": return <><ProductionTab /><ProductionForecast /></>;
      case "egg-grading": return <EggGradingTab />;
      case "cracked-eggs": return <CrackedEggsTab />;
      case "feed": return <FeedTab />;
      case "inventory-plus": return <InventoryPlusTab />;
      case "expected-stock": return <ExpectedStockTab />;
      case "sales": return <SalesTab />;
      case "expenses": return <ExpensesTab />;
      case "finance": return <><FinanceTab /><ProfitabilityHeatmap /></>;
      case "expected-profit": return <ExpectedProfitTab />;
      case "salary": return <WorkerSalaryTab />;
      case "users": return <><UsersTab /><WorkerBranchAssignment /></>;
      case "partners": return <PartnersTab />;
      case "withdrawals": return <PartnerWithdrawalsTab />;
      case "complaints": return <PartnerComplaintsTab />;
      case "reviews": return <WorkerReviewsTab />;
      case "suppliers": return <SuppliersTab />;
      case "customers": return <><CustomersTab /><CustomerOrdersSection /></>;
      case "cleaning": return <CleaningManagementTab />;
      case "operations": return <OperationsTab />;
      case "balancing": return <BalancingTab />;
      case "reports": return <><ReportsTab /><WeeklyReportButton /></>;
      case "notes": return <NotesTab />;
      case "ai-advisor": return <AiFarmAdvisorTab />;
      case "analytics": return <CostPerBirdAnalytics />;
      case "branches": return <BranchManagementTab />;
      default: return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
        <AdminSidebar activeTab={activeTab} onChange={setActiveTab} />

        <SidebarInset className="flex-1 min-w-0">
          <header className="border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10 shadow-sm">
            <div className="px-3 sm:px-6 py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <SidebarTrigger />
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm shrink-0">
                    <Sprout className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base font-bold text-foreground truncate">{TAB_TITLES[activeTab]}</h1>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Admin • {currentBranch?.name || "All Branches"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  <BranchSelector />
                  <Button variant="ghost" size="sm" onClick={() => navigate("/farm-summary")}>
                    <BarChart3 className="h-4 w-4 sm:mr-1" />
                    <span className="hidden md:inline">Summary</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
                    <UserCircle className="h-4 w-4 sm:mr-1" />
                    <span className="hidden md:inline">Profile</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 sm:mr-1" />
                    <span className="hidden md:inline">Sign Out</span>
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {!currentBranchId && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    <p className="text-sm font-medium">Switch to Abeokuta branch?</p>
                  </div>
                  <Button size="sm" onClick={switchToAbeokuta}>Yes, Switch to Abeokuta</Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4 sm:space-y-6">
              {renderTab()}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
