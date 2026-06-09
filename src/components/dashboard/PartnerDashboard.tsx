import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Sprout, Handshake, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BatchDetailView from "./admin/livestock/BatchDetailView";

const SPECIES_ICONS: Record<string, string> = {
  chicken: "🐔", pig: "🐷", goat: "🐐", cattle: "🐄", other: "🐾",
};

interface Props { user: User | null }

const PartnerDashboard = ({ user }: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [name, setName] = useState("");

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
    setLinks((pb || []).filter((l: any) => l.livestock_batches));
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
  };

  if (selectedBatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="border-b bg-card/95 backdrop-blur sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              <p className="font-semibold text-sm">Partner Portal — {name}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-4">
          <BatchDetailView batch={selectedBatch} onBack={() => { setSelectedBatch(null); load(); }} />
        </main>
      </div>
    );
  }

  const totalInvestment = links.reduce((s, l) => s + Number(l.investment_amount || 0), 0);
  const totalAnimals = links.reduce((s, l) => s + (l.livestock_batches?.current_quantity || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b border-border/40 bg-card/95 backdrop-blur sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Handshake className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold leading-tight">Partner Portal</h1>
                <p className="text-xs text-muted-foreground">Welcome, {name}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-6 py-5 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 sm:p-4 text-center">
            <p className="text-2xl font-bold text-primary">{links.length}</p>
            <p className="text-xs text-muted-foreground">My Batches</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4 text-center">
            <p className="text-2xl font-bold">{totalAnimals}</p>
            <p className="text-xs text-muted-foreground">Animals</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold">₦{totalInvestment.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Invested</p>
          </CardContent></Card>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Sprout className="h-4 w-4 text-primary" />
            My Partnered Batches
          </h2>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : links.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Handshake className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No batches linked yet</p>
              <p className="text-sm">An admin will link you to your investment batches.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {links.map((l: any) => {
                const b = l.livestock_batches;
                return (
                  <Card key={l.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedBatch(b)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl">{SPECIES_ICONS[b.species] || "🐾"}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-semibold capitalize text-sm sm:text-base">
                                {b.species_type || b.species}
                              </p>
                              <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px]">
                                {b.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {b.stage && (
                                <Badge variant="outline" className="text-[10px] capitalize">{b.stage.replace(/_/g, " ")}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {b.current_quantity}/{b.quantity} • {b.age_weeks}w • {new Date(b.date_acquired).toLocaleDateString()}
                            </p>
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              <Badge variant="secondary" className="text-[10px]">{l.share_percentage}% share</Badge>
                              <Badge variant="outline" className="text-[10px]">₦{Number(l.investment_amount).toLocaleString()}</Badge>
                            </div>
                          </div>
                        </div>
                        <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground pt-4">
          Tap a batch to view & record vaccines, mortality, feed, care logs and more.
        </p>
      </main>
    </div>
  );
};

export default PartnerDashboard;
