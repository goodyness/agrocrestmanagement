import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays, differenceInDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Activity, AlertTriangle, Calendar, TrendingDown, Syringe, Utensils } from "lucide-react";

export function HealthDashboard() {
  // Fetch mortality records
  const { data: mortalityData } = useQuery({
    queryKey: ["mortality-trends"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("mortality_records")
        .select(`
          *,
          livestock_categories (name)
        `)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch vaccination records and schedules
  const { data: vaccinationData } = useQuery({
    queryKey: ["vaccination-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaccination_records")
        .select(`
          *,
          vaccination_types (name, interval_weeks),
          livestock_categories (name)
        `)
        .order("administered_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch upcoming vaccinations
  const { data: upcomingVaccinations } = useQuery({
    queryKey: ["upcoming-vaccinations"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const nextWeek = subDays(new Date(), -7).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("vaccination_records")
        .select(`
          *,
          vaccination_types (name),
          livestock_categories (name)
        `)
        .gte("next_due_date", today)
        .lte("next_due_date", nextWeek)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch feed consumption data
  const { data: feedData } = useQuery({
    queryKey: ["feed-health"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("feed_consumption")
        .select(`
          *,
          feed_types (feed_name),
          livestock_categories (name)
        `)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch livestock census for context
  const { data: censusData } = useQuery({
    queryKey: ["census-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestock_census")
        .select(`
          *,
          livestock_categories (name)
        `);
      if (error) throw error;
      return data;
    },
  });

  // Process mortality trends by date
  const mortalityTrends = mortalityData?.reduce((acc: any[], record) => {
    const existingDate = acc.find((item) => item.date === record.date);
    if (existingDate) {
      existingDate.deaths += record.quantity_dead;
    } else {
      acc.push({
        date: record.date,
        deaths: record.quantity_dead,
        formattedDate: format(new Date(record.date), "MMM dd"),
      });
    }
    return acc;
  }, []) || [];

  // Process mortality by category
  const mortalityByCategory = mortalityData?.reduce((acc: any[], record) => {
    const categoryName = record.livestock_categories?.name || "Unknown";
    const existing = acc.find((item) => item.name === categoryName);
    if (existing) {
      existing.value += record.quantity_dead;
    } else {
      acc.push({ name: categoryName, value: record.quantity_dead });
    }
    return acc;
  }, []) || [];

  // Process feed consumption by type
  const feedByType = feedData?.reduce((acc: any[], record) => {
    const feedName = record.feed_types?.feed_name || "Unknown";
    const existing = acc.find((item) => item.name === feedName);
    if (existing) {
      existing.quantity += Number(record.quantity_used);
    } else {
      acc.push({ name: feedName, quantity: Number(record.quantity_used) });
    }
    return acc;
  }, []) || [];

  // Calculate health metrics
  const totalMortality = mortalityData?.reduce((sum, r) => sum + r.quantity_dead, 0) || 0;
  const totalBirds = censusData?.reduce((sum, c) => sum + c.updated_count, 0) || 0;
  const mortalityRate = totalBirds > 0 ? ((totalMortality / totalBirds) * 100).toFixed(2) : "0";
  
  const overdueVaccinations = vaccinationData?.filter((v) => {
    const dueDate = new Date(v.next_due_date);
    return dueDate < new Date();
  }).length || 0;

  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--secondary))", "hsl(var(--accent))"];

  return (
    <div className="space-y-6">
      {/* Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">30-Day Mortality</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMortality}</div>
            <p className="text-xs text-muted-foreground">
              {mortalityRate}% mortality rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Livestock</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBirds}</div>
            <p className="text-xs text-muted-foreground">
              Across {censusData?.length || 0} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Vaccinations</CardTitle>
            <Syringe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingVaccinations?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Due in next 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Vaccinations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueVaccinations}</div>
            <p className="text-xs text-muted-foreground">Need immediate attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mortality Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Mortality Trend (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mortalityTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="formattedDate" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="deaths"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    name="Deaths"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Mortality by Category Pie Chart */}
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
                    <Pie
                      data={mortalityByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {mortalityByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No mortality data in the last 30 days
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feed Consumption & Vaccination Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feed Consumption by Type */}
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

        {/* Upcoming Vaccinations List */}
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
                    <div
                      key={vacc.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{vacc.vaccination_types?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {vacc.livestock_categories?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={daysUntil <= 2 ? "destructive" : "secondary"}
                        >
                          {daysUntil === 0
                            ? "Today"
                            : daysUntil === 1
                            ? "Tomorrow"
                            : `In ${daysUntil} days`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(vacc.next_due_date), "MMM dd, yyyy")}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No vaccinations due in the next 7 days
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Vaccination History */}
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
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Syringe className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium">{record.vaccination_types?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.livestock_categories?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {format(new Date(record.administered_date), "MMM dd, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Next: {format(new Date(record.next_due_date), "MMM dd")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No vaccination records yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
