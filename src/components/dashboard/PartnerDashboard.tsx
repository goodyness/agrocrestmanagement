import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  LogOut, Handshake, LayoutDashboard, Sprout, Eye, TrendingUp,
  Wallet, Users as UsersIcon, Skull, Package,
} from "lucide-react";
import { toast } from "sonner";
import BatchDetailView from "./admin/livestock/BatchDetailView";

const SPECIES_ICONS: Record<string, string> = {
  chicken: "🐔", pig: "🐷", goat: "🐐", cattle: "🐄", other: "🐾",
};

type SectionKey = "overview" | "batches";

interface SidebarProps {
  active: SectionKey;
  onChange: (k: SectionKey) => void;
}

const PartnerSidebar = ({ active, onChange }: SidebarProps) => {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const items: { key: SectionKey; title: string; icon: any }[] = [
    { key: "overview", title: "Overview", icon: LayoutDashboard },
    { key: "batches", title: "My Batches", icon: Sprout },
  ];
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Partner Portal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => {
                const Icon = it.icon;
                return (
                  <SidebarMenuItem key={it.key}>
                    <SidebarMenuButton
                      isActive={active === it.key}
                      onClick={() => { onChange(it.key); if (isMobile) setOpenMobile(false); }}
                      tooltip={it.title}
                      className="cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

interface Props { user: User | null }

const PartnerDashboard = ({ user }: Props) => {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [section, setSection] = useState<SectionKey>("overview");

  // Aggregated stats
  const [mortalityCount, setMortalityCount] = useState(0);
  const [totalExpensesAgg, setTotalExpensesAgg] = useState(0);
  const [totalProductionAgg, setTotalProductionAgg] = useState(0);

  const load = async () => {
    setLoading(true);
    const [{ data: profile }, { data: pb }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user?.id || "").single(),
      supabase
        .from("partner_batches")
        .select("*, livestock_batches(*)")
        .order("created_at", { ascending: false }),
    ]);
    setName(profile?.name || user?.email || "Partner");
    const validLinks = (pb || []).filter((l: any) => l.livestock_batches);
    setLinks(validLinks);

    const batchIds = validLinks.map((l: any) => l.livestock_batches?.id).filter(Boolean);
    if (batchIds.length > 0) {
      const [{ data: mort }, { data: exp }, { data: prod }] = await Promise.all([
        supabase.from("mortality_records").select("quantity_dead").in("batch_id", batchIds),
        supabase.from("miscellaneous_expenses").select("amount").in("batch_id", batchIds),
        supabase.from("daily_production").select("quantity, unit").in("batch_id", batchIds),
      ]);
      setMortalityCount((mort || []).reduce((s, r: any) => s + Number(r.quantity_dead || 0), 0));
      setTotalExpensesAgg((exp || []).reduce((s, r: any) => s + Number(r.amount || 0), 0));
      setTotalProductionAgg((prod || []).reduce((s, r: any) => s + Number(r.quantity || 0), 0));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
  };

  const totalInvestment = links.reduce((s, l) => s + Number(l.investment_amount || 0), 0);
  const totalAnimals = links.reduce((s, l) => s + (l.livestock_batches?.current_quantity || 0), 0);
  const totalInitial = links.reduce((s, l) => s + (l.livestock_batches?.quantity || 0), 0);
  const totalBudget = links.reduce((s, l) => s + Number(l.livestock_batches?.budget || 0), 0);
  const survivalRate = totalInitial > 0 ? (totalAnimals / totalInitial) * 100 : 0;
  const budgetUsagePct = totalBudget > 0 ? Math.min(100, (totalExpensesAgg / totalBudget) * 100) : 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
        <PartnerSidebar active={section} onChange={(k) => { setSection(k); setSelectedBatch(null); }} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/40 bg-card/95 backdrop-blur sticky top-0 z-20 shadow-sm">
            <div className="h-full px-3 sm:px-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger />
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow shrink-0">
                  <Handshake className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">Partner Portal</p>
                  <p className="text-[11px] text-muted-foreground truncate">Welcome, {name}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
            {selectedBatch ? (
              <BatchDetailView batch={selectedBatch} onBack={() => { setSelectedBatch(null); load(); }} />
            ) : loading ? (
              <div className="text-center py-16 text-muted-foreground">Loading your portal...</div>
            ) : section === "overview" ? (
              <div className="space-y-5 max-w-5xl mx-auto">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                  <p className="text-sm text-muted-foreground">Your investment summary across all partnered batches.</p>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Batches</p>
                        <Sprout className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-2xl font-bold">{links.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Live Animals</p>
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-2xl font-bold">{totalAnimals}</p>
                      <p className="text-[11px] text-muted-foreground">of {totalInitial} started</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Invested</p>
                        <Wallet className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-xl font-bold">₦{totalInvestment.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Mortalities</p>
                        <Skull className="h-4 w-4 text-destructive" />
                      </div>
                      <p className="text-2xl font-bold text-destructive">{mortalityCount}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress cards */}
                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" /> Survival Rate
                        </p>
                        <span className="text-sm font-bold">{survivalRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={survivalRate} />
                      <p className="text-xs text-muted-foreground">{totalAnimals} of {totalInitial} animals still alive</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-primary" /> Budget Usage
                        </p>
                        <span className="text-sm font-bold">{budgetUsagePct.toFixed(0)}%</span>
                      </div>
                      <Progress value={budgetUsagePct} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Spent ₦{totalExpensesAgg.toLocaleString()}</span>
                        <span>Budget ₦{totalBudget.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {totalProductionAgg > 0 && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Total Production Recorded</p>
                        <p className="text-lg font-bold text-primary">{totalProductionAgg.toLocaleString()} units</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Species breakdown analytics */}
                {links.length > 0 && (() => {
                  const bySpecies: Record<string, { count: number; alive: number; invested: number }> = {};
                  links.forEach((l: any) => {
                    const b = l.livestock_batches; if (!b) return;
                    const key = b.species_type || b.species || "other";
                    bySpecies[key] = bySpecies[key] || { count: 0, alive: 0, invested: 0 };
                    bySpecies[key].count += 1;
                    bySpecies[key].alive += b.current_quantity || 0;
                    bySpecies[key].invested += Number(l.investment_amount || 0);
                  });
                  const rows = Object.entries(bySpecies);
                  const maxAlive = Math.max(...rows.map(([, v]) => v.alive), 1);
                  return (
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium mb-3">Portfolio Breakdown</p>
                        <div className="space-y-2">
                          {rows.map(([sp, v]) => (
                            <div key={sp}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="capitalize font-medium">{SPECIES_ICONS[sp] || "🐾"} {sp.replace(/_/g, " ")}</span>
                                <span className="text-muted-foreground">{v.count} batch(es) • {v.alive} alive • ₦{v.invested.toLocaleString()}</span>
                              </div>
                              <div className="h-2 bg-muted rounded overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${(v.alive / maxAlive) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ROI snapshot */}
                {totalInvestment > 0 && (
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                    <CardContent className="p-4 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Cost / animal</p>
                        <p className="font-bold">₦{totalAnimals > 0 ? Math.round((totalInvestment + totalExpensesAgg) / totalAnimals).toLocaleString() : 0}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Loss rate</p>
                        <p className="font-bold text-destructive">{totalInitial > 0 ? ((mortalityCount / totalInitial) * 100).toFixed(1) : 0}%</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Prod / animal</p>
                        <p className="font-bold">{totalAnimals > 0 ? (totalProductionAgg / totalAnimals).toFixed(1) : 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium mb-1">Recent Batches</p>
                    <div className="space-y-2">
                      {links.slice(0, 3).map((l: any) => {
                        const b = l.livestock_batches;
                        return (
                          <button
                            key={l.id}
                            onClick={() => setSelectedBatch(b)}
                            className="w-full text-left p-2 rounded hover:bg-background transition flex items-center gap-2"
                          >
                            <span className="text-xl">{SPECIES_ICONS[b.species] || "🐾"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium capitalize truncate">{b.species_type || b.species}</p>
                              <p className="text-xs text-muted-foreground">{b.current_quantity} animals • {b.age_weeks}w</p>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </button>
                        );
                      })}
                      {links.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No batches linked yet.</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-4 max-w-5xl mx-auto">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">My Batches</h1>
                  <p className="text-sm text-muted-foreground">Tap a batch to record care, expenses, mortality and more.</p>
                </div>

                {links.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Handshake className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">No batches linked yet</p>
                      <p className="text-sm">An admin will link you to your investment batches.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {links.map((l: any) => {
                      const b = l.livestock_batches;
                      const survival = b.quantity > 0 ? (b.current_quantity / b.quantity) * 100 : 0;
                      return (
                        <Card key={l.id} className="cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all"
                          onClick={() => setSelectedBatch(b)}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-3xl">{SPECIES_ICONS[b.species] || "🐾"}</span>
                                <div className="min-w-0">
                                  <p className="font-semibold capitalize">{b.species_type || b.species}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {b.current_quantity}/{b.quantity} • {b.age_weeks}w • {new Date(b.date_acquired).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px]">
                                  {b.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {b.stage && (
                                  <Badge variant="outline" className="text-[10px] capitalize">{b.stage.replace(/_/g, " ")}</Badge>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Survival</span>
                                <span className="font-medium">{survival.toFixed(0)}%</span>
                              </div>
                              <Progress value={survival} className="h-1.5" />
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                              <Badge variant="secondary" className="text-[10px]">{l.share_percentage}% ownership</Badge>
                              <Badge variant="secondary" className="text-[10px]">{l.profit_share_percentage ?? l.share_percentage}% profit</Badge>
                              <Badge variant="outline" className="text-[10px]">₦{Number(l.investment_amount).toLocaleString()}</Badge>
                            </div>

                            <div className="flex items-center justify-end text-xs text-primary font-medium">
                              View & manage <Eye className="h-3.5 w-3.5 ml-1" />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default PartnerDashboard;
