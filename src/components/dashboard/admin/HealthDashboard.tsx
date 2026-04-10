import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays, differenceInDays } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Activity, AlertTriangle, Calendar, TrendingDown, Syringe, Utensils, FileDown, ShieldAlert, ThermometerSun, HeartPulse, Filter } from "lucide-react";
import { generateHealthReportPdf } from "@/lib/healthReportPdf";
import { toast } from "sonner";

export function HealthDashboard() {
  const { currentBranchId, currentBranch } = useBranch();
  const [mortalityFromDate, setMortalityFromDate] = useState(subDays(new Date(), 60).toISOString().split("T")[0]);
  const [mortalityToDate, setMortalityToDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: mortalityData } = useQuery({
    queryKey: ["mortality-trends", currentBranchId, mortalityFromDate, mortalityToDate],
    queryFn: async () => {
      let query = supabase.from("mortality_records")
        .select("*, livestock_categories (name), profiles:recorded_by (name)")
        .gte("date", mortalityFromDate)
        .lte("date", mortalityToDate)
        .order("date", { ascending: true });
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: vaccinationData } = useQuery({
    queryKey: ["vaccination-health", currentBranchId],
    queryFn: async () => {
      let query = supabase.from("vaccination_records")
        .select("*, vaccination_types (name, interval_weeks), livestock_categories (name)")
        .order("administered_date", { ascending: false }).limit(50);
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: upcomingVaccinations } = useQuery({
    queryKey: ["upcoming-vaccinations", currentBranchId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const nextWeek = subDays(new Date(), -7).toISOString().split("T")[0];
      let query = supabase.from("vaccination_records")
        .select("*, vaccination_types (name), livestock_categories (name)")
        .gte("next_due_date", today).lte("next_due_date", nextWeek)
        .order("next_due_date", { ascending: true });
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: feedData } = useQuery({
    queryKey: ["feed-health", currentBranchId],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      let query = supabase.from("feed_consumption")
        .select("*, feed_types (feed_name), livestock_categories (name)")
        .gte("date", thirtyDaysAgo).order("date", { ascending: true });
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: censusData } = useQuery({
    queryKey: ["census-health", currentBranchId],
    queryFn: async () => {
      let query = supabase.from("livestock_census").select("*, livestock_categories (name)");
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: productionData } = useQuery({
    queryKey: ["production-health", currentBranchId],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      let query = supabase.from("daily_production")
        .select("date, crates, pieces")
        .gte("date", thirtyDaysAgo).order("date", { ascending: true });
      if (currentBranchId) query = query.eq("branch_id", currentBranchId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // --- Disease Outbreak Detection ---
  const detectOutbreaks = () => {
    if (!mortalityData || mortalityData.length < 3) return [];
    const alerts: { type: string; severity: "critical" | "warning" | "info"; message: string; date: string }[] = [];
    
    // Group by date
    const byDate: Record<string, number> = {};
    mortalityData.forEach((r) => {
      byDate[r.date] = (byDate[r.date] || 0) + r.quantity_dead;
    });
    const dates = Object.keys(byDate).sort();
    
    // Check for spike: if any day is 3x the average
    const values = dates.map(d => byDate[d]);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    
    dates.forEach((date) => {
      if (byDate[date] > avg * 3 && byDate[date] > 3) {
        alerts.push({
          type: "Mortality Spike",
          severity: "critical",
          message: `${byDate[date]} deaths on ${format(new Date(date), "MMM dd")} — ${(byDate[date] / avg).toFixed(1)}x above average (${avg.toFixed(1)}/day)`,
          date,
        });
      }
    });

    // Check for consecutive increase (3+ days rising)
    for (let i = 2; i < dates.length; i++) {
      if (byDate[dates[i]] > byDate[dates[i-1]] && byDate[dates[i-1]] > byDate[dates[i-2]] && byDate[dates[i]] > 2) {
        alerts.push({
          type: "Rising Trend",
          severity: "warning",
          message: `3-day rising mortality: ${byDate[dates[i-2]]} → ${byDate[dates[i-1]]} → ${byDate[dates[i]]} (${format(new Date(dates[i-2]), "MMM dd")} - ${format(new Date(dates[i]), "MMM dd")})`,
          date: dates[i],
        });
      }
    }

    // Check for sudden drop in production alongside mortality
    if (productionData && productionData.length > 7) {
      const recentProd = productionData.slice(-7);
      const olderProd = productionData.slice(-14, -7);
      const recentAvg = recentProd.reduce((s, p) => s + p.crates, 0) / recentProd.length;
      const olderAvg = olderProd.reduce((s, p) => s + p.crates, 0) / (olderProd.length || 1);
      
      if (olderAvg > 0 && recentAvg < olderAvg * 0.7) {
        alerts.push({
          type: "Production Drop",
          severity: "warning",
          message: `Production dropped ${((1 - recentAvg / olderAvg) * 100).toFixed(0)}% this week vs last week — may indicate health issues`,
          date: new Date().toISOString().split("T")[0],
        });
      }
    }

    return alerts.slice(0, 5);
  };

  const outbreakAlerts = detectOutbreaks();

  // Process trends
  const mortalityTrends = mortalityData?.reduce((acc: any[], record) => {
    const existingDate = acc.find((item) => item.date === record.date);
    if (existingDate) { existingDate.deaths += record.quantity_dead; }
    else { acc.push({ date: record.date, deaths: record.quantity_dead, formattedDate: format(new Date(record.date), "MMM dd") }); }
    return acc;
  }, []) || [];

  const mortalityByCategory = mortalityData?.reduce((acc: any[], record) => {
    const categoryName = record.livestock_categories?.name || "Unknown";
    const existing = acc.find((item) => item.name === categoryName);
    if (existing) { existing.value += record.quantity_dead; }
    else { acc.push({ name: categoryName, value: record.quantity_dead }); }
    return acc;
  }, []) || [];

  const feedByType = feedData?.reduce((acc: any[], record) => {
    const feedName = record.feed_types?.feed_name || "Unknown";
    const existing = acc.find((item) => item.name === feedName);
    if (existing) { existing.quantity += Number(record.quantity_used); }
    else { acc.push({ name: feedName, quantity: Number(record.quantity_used) }); }
    return acc;
  }, []) || [];

  // Mortality + Production correlation chart
  const correlationData = (() => {
    if (!mortalityData || !productionData) return [];
    const dateMap: Record<string, { deaths: number; crates: number }> = {};
    mortalityData.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { deaths: 0, crates: 0 };
      dateMap[r.date].deaths += r.quantity_dead;
    });
    productionData?.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { deaths: 0, crates: 0 };
      dateMap[r.date].crates += r.crates;
    });
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, data]) => ({
        date: format(new Date(date), "MMM dd"),
        deaths: data.deaths,
        production: data.crates,
      }));
  })();

  const totalMortality = mortalityData?.reduce((sum, r) => sum + r.quantity_dead, 0) || 0;
  const totalBirds = censusData?.reduce((sum, c) => sum + c.updated_count, 0) || 0;
  const mortalityRate = totalBirds > 0 ? ((totalMortality / totalBirds) * 100).toFixed(2) : "0";
  const overdueVaccinations = vaccinationData?.filter((v) => new Date(v.next_due_date) < new Date()).length || 0;

  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--secondary))", "hsl(var(--accent))"];

  // Health Score calculation
  const healthScore = (() => {
    let score = 100;
    if (Number(mortalityRate) > 5) score -= 30;
    else if (Number(mortalityRate) > 2) score -= 15;
    else if (Number(mortalityRate) > 1) score -= 5;
    score -= overdueVaccinations * 10;
    score -= outbreakAlerts.filter(a => a.severity === "critical").length * 20;
    score -= outbreakAlerts.filter(a => a.severity === "warning").length * 10;
    return Math.max(0, Math.min(100, score));
  })();

  const getHealthLabel = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "text-success" };
    if (score >= 60) return { label: "Good", color: "text-primary" };
    if (score >= 40) return { label: "Fair", color: "text-warning" };
    return { label: "Critical", color: "text-destructive" };
  };

  const healthLabel = getHealthLabel(healthScore);

  const handleExportPdf = () => {
    try {
      generateHealthReportPdf({
        branchName: currentBranch?.name || "All Branches",
        mortalityRecords: mortalityData || [],
        vaccinationRecords: vaccinationData || [],
        feedConsumption: feedData || [],
        censusData: censusData || [],
        reportDate: new Date(),
      });
      toast.success("Health report PDF generated!");
    } catch (error: any) {
      toast.error("Failed to generate PDF: " + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            Health & Disease Monitor
          </h2>
          <p className="text-muted-foreground">Disease outbreak detection and livestock health tracking</p>
        </div>
        <Button onClick={handleExportPdf} variant="outline">
          <FileDown className="h-4 w-4 mr-2" />
          Export Report (PDF)
        </Button>
      </div>

      {/* Disease Outbreak Alerts */}
      {outbreakAlerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Disease Outbreak Alerts
            </CardTitle>
            <CardDescription>Automated detection based on mortality patterns and production data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {outbreakAlerts.map((alert, idx) => (
                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg ${
                  alert.severity === 'critical' ? 'bg-destructive/10 border border-destructive/20' : 'bg-warning/10 border border-warning/20'
                }`}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                    alert.severity === 'critical' ? 'text-destructive' : 'text-warning'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{alert.type}</span>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <HeartPulse className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${healthLabel.color}`}>{healthScore}</div>
            <p className={`text-xs font-medium ${healthLabel.color}`}>{healthLabel.label}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">60-Day Mortality</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMortality}</div>
            <p className="text-xs text-muted-foreground">{mortalityRate}% mortality rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Livestock</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBirds}</div>
            <p className="text-xs text-muted-foreground">{censusData?.length || 0} categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Vaccinations</CardTitle>
            <Syringe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingVaccinations?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Due in 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueVaccinations}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Mortality vs Production Correlation */}
      {correlationData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ThermometerSun className="h-5 w-5" />
              Mortality vs Production Correlation
            </CardTitle>
            <CardDescription>When mortality rises, production typically drops — watch for this pattern</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={correlationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={10} />
                  <YAxis yAxisId="left" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="production" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Production (crates)" />
                  <Area yAxisId="right" type="monotone" dataKey="deaths" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} name="Deaths" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Mortality Trend
            </CardTitle>
            <CardDescription>Filter by date range</CardDescription>
            <div className="flex flex-wrap items-end gap-3 mt-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={mortalityFromDate} onChange={(e) => setMortalityFromDate(e.target.value)} className="w-auto" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={mortalityToDate} onChange={(e) => setMortalityToDate(e.target.value)} className="w-auto" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setMortalityFromDate(subDays(new Date(), 7).toISOString().split("T")[0]); setMortalityToDate(new Date().toISOString().split("T")[0]); }}>7d</Button>
                <Button size="sm" variant="outline" onClick={() => { setMortalityFromDate(subDays(new Date(), 30).toISOString().split("T")[0]); setMortalityToDate(new Date().toISOString().split("T")[0]); }}>30d</Button>
                <Button size="sm" variant="outline" onClick={() => { setMortalityFromDate(subDays(new Date(), 60).toISOString().split("T")[0]); setMortalityToDate(new Date().toISOString().split("T")[0]); }}>60d</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mortalityTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="formattedDate" fontSize={10} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="deaths" stroke="hsl(var(--destructive))" strokeWidth={2} name="Deaths" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Mortality by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {mortalityByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mortalityByCategory} cx="50%" cy="50%" labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`} outerRadius={100}
                      dataKey="value">
                      {mortalityByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No mortality data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Mortality Records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Detailed Mortality Records ({mortalityFromDate} to {mortalityToDate})
          </CardTitle>
          <CardDescription>
            Total: {mortalityData?.reduce((s, r) => s + r.quantity_dead, 0) || 0} deaths across {mortalityData?.length || 0} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty Dead</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mortalityData && mortalityData.length > 0 ? (
                  mortalityData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{(record.livestock_categories as any)?.name || "—"}</TableCell>
                      <TableCell className="font-medium text-destructive">{record.quantity_dead}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.reason || "—"}</TableCell>
                      <TableCell>{(record.profiles as any)?.name || "Unknown"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No mortality records in this period</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Feed Consumption (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feedByType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" name="Quantity Used" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Vaccinations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {upcomingVaccinations && upcomingVaccinations.length > 0 ? (
                upcomingVaccinations.map((vacc) => {
                  const daysUntil = differenceInDays(new Date(vacc.next_due_date), new Date());
                  return (
                    <div key={vacc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{vacc.vaccination_types?.name}</p>
                        <p className="text-sm text-muted-foreground">{vacc.livestock_categories?.name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={daysUntil <= 2 ? "destructive" : "secondary"}>
                          {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(vacc.next_due_date), "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">No vaccinations due in 7 days</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            Recent Vaccination History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {vaccinationData && vaccinationData.length > 0 ? (
              vaccinationData.slice(0, 10).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Syringe className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">{record.vaccination_types?.name}</p>
                      <p className="text-sm text-muted-foreground">{record.livestock_categories?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{format(new Date(record.administered_date), "MMM dd, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">Next: {format(new Date(record.next_due_date), "MMM dd")}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">No vaccination records yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
