import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BarChart3, Activity, Sprout, PawPrint, Syringe, Heart, Stethoscope, Egg, AlertTriangle,
  TrendingUp, Package, Boxes, DollarSign, Landmark, Wallet, Users as UsersIcon, Handshake,
  ClipboardCheck, Truck, Users, Brush, Wrench, Scale, FileText, StickyNote, Bot, Calculator,
  Building2, GitCompareArrows, Skull, ChefHat,
} from "lucide-react";

export type AdminTabKey =
  | "overview" | "activity"
  | "intake" | "livestock" | "vaccination" | "clinic" | "health"
  | "production" | "egg-grading" | "cracked-eggs"
  | "feed" | "inventory-plus" | "expected-stock"
  | "sales" | "expenses" | "finance" | "expected-profit" | "salary"
  | "users" | "partners" | "withdrawals" | "complaints" | "reviews" | "suppliers" | "customers"
  | "cleaning" | "operations" | "balancing"
  | "reports" | "notes" | "ai-advisor" | "analytics" | "batch-compare" | "mortality-analytics" | "feed-recipes"
  | "branches";

interface Group {
  label: string;
  items: { key: AdminTabKey; title: string; icon: any }[];
}

const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [
      { key: "overview", title: "Dashboard", icon: BarChart3 },
      { key: "activity", title: "Activity", icon: Activity },
    ],
  },
  {
    label: "Livestock",
    items: [
      { key: "intake", title: "Intake", icon: PawPrint },
      { key: "livestock", title: "Livestock", icon: Sprout },
      { key: "vaccination", title: "Vaccination", icon: Syringe },
      { key: "clinic", title: "Clinic", icon: Stethoscope },
      { key: "health", title: "Health", icon: Heart },
    ],
  },
  {
    label: "Production",
    items: [
      { key: "production", title: "Production", icon: TrendingUp },
      { key: "egg-grading", title: "Egg Grading", icon: Egg },
      { key: "cracked-eggs", title: "Cracked Eggs", icon: AlertTriangle },
    ],
  },
  {
    label: "Feed & Inventory",
    items: [
      { key: "feed", title: "Feed", icon: Package },
      { key: "inventory-plus", title: "Inventory+", icon: Boxes },
      { key: "expected-stock", title: "Expected Stock", icon: Boxes },
      { key: "feed-recipes", title: "Feed Recipes", icon: ChefHat },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "sales", title: "Sales", icon: DollarSign },
      { key: "expenses", title: "Expenses", icon: DollarSign },
      { key: "finance", title: "Finance", icon: Landmark },
      { key: "expected-profit", title: "Expected Profit", icon: Wallet },
      { key: "salary", title: "Salary", icon: Wallet },
    ],
  },
  {
    label: "People",
    items: [
      { key: "users", title: "Users", icon: UsersIcon },
      { key: "partners", title: "Partners", icon: Handshake },
      { key: "withdrawals", title: "Withdrawals", icon: Wallet },
      { key: "complaints", title: "Complaints", icon: AlertTriangle },
      { key: "reviews", title: "Reviews", icon: ClipboardCheck },
      { key: "suppliers", title: "Suppliers", icon: Truck },
      { key: "customers", title: "Customers", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "cleaning", title: "Cleaning", icon: Brush },
      { key: "operations", title: "Operations", icon: Wrench },
      { key: "balancing", title: "Balancing", icon: Scale },
    ],
  },
  {
    label: "Insights",
    items: [
      { key: "reports", title: "Reports", icon: FileText },
      { key: "notes", title: "Notes", icon: StickyNote },
      { key: "ai-advisor", title: "AI Advisor", icon: Bot },
      { key: "analytics", title: "Cost Analytics", icon: Calculator },
      { key: "batch-compare", title: "Batch Compare", icon: GitCompareArrows },
      { key: "mortality-analytics", title: "Mortality Causes", icon: Skull },
    ],
  },
  {
    label: "Settings",
    items: [
      { key: "branches", title: "Branches", icon: Building2 },
    ],
  },
];

interface Props {
  activeTab: AdminTabKey;
  onChange: (tab: AdminTabKey) => void;
}

export const AdminSidebar = ({ activeTab, onChange }: Props) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => onChange(item.key)}
                        tooltip={item.title}
                        className="cursor-pointer"
                      >
                        <Icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;
