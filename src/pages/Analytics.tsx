import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, Package, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getYear, getMonth } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useBranch } from "@/contexts/BranchContext";

const Analytics = () => {
  const navigate = useNavigate();
  const { currentBranchId } = useBranch();
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [chartData, setChartData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ production: 0, sales: 0 });

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth) - 1; // JS months are 0-indexed
      
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));
      
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Fetch production data
      let productionQuery = supabase
        .from("daily_production")
        .select("date, crates, pieces")
        .gte("date", startStr)
        .lte("date", endStr);

      if (currentBranchId) {
        productionQuery = productionQuery.eq("branch_id", currentBranchId);
      }

      const { data: productionData } = await productionQuery;

      // Fetch sales data (eggs only - crates and pieces units)
      let salesQuery = supabase
        .from("sales_records")
        .select("date, quantity, unit")
        .gte("date", startStr)
        .lte("date", endStr)
        .in("unit", ["crates", "pieces", "crate", "piece"]);

      if (currentBranchId) {
        salesQuery = salesQuery.eq("branch_id", currentBranchId);
      }

      const { data: salesData } = await salesQuery;

      // Generate all days in the month
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });

      // Aggregate data by day
      const dailyData = allDays.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayLabel = format(day, "d");

        // Sum production for this day (convert to crates: 1 crate = 30 pieces)
        const dayProduction = productionData?.filter(p => p.date === dateStr) || [];
        const productionPieces = dayProduction.reduce((sum, p) => {
          return sum + (p.crates * 30) + p.pieces;
        }, 0);
        const productionCrates = productionPieces / 30;

        // Sum sales for this day (convert to crates)
        const daySales = salesData?.filter(s => s.date === dateStr) || [];
        const salesPieces = daySales.reduce((sum, s) => {
          if (s.unit === "crates" || s.unit === "crate") {
            return sum + (s.quantity * 30);
          }
          return sum + s.quantity;
        }, 0);
        const salesCrates = salesPieces / 30;

        return {
          day: dayLabel,
          date: dateStr,
          production: Math.round(productionCrates * 100) / 100,
          sales: Math.round(salesCrates * 100) / 100,
        };
      });

      setChartData(dailyData);

      // Calculate totals
      const totalProduction = dailyData.reduce((sum, d) => sum + d.production, 0);
      const totalSales = dailyData.reduce((sum, d) => sum + d.sales, 0);
      setTotals({
        production: Math.round(totalProduction * 100) / 100,
        sales: Math.round(totalSales * 100) / 100,
      });

    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, currentBranchId]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Production vs Sales Analytics</h1>
            <p className="text-muted-foreground">Compare daily production and sales for any month</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Production</p>
                  <p className="text-2xl font-bold">{totals.production.toLocaleString()} crates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-chart-2/20">
                  <DollarSign className="h-6 w-6 text-chart-2" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">{totals.sales.toLocaleString()} crates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-chart-4/20">
                  <TrendingUp className="h-6 w-6 text-chart-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Difference</p>
                  <p className="text-2xl font-bold">
                    {(totals.production - totals.sales).toLocaleString()} crates
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Trend - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
            <CardDescription>Production vs Sales in crates per day</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="production" 
                    name="Production (crates)"
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-1))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    name="Sales (crates)"
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Comparison</CardTitle>
            <CardDescription>Side-by-side view of production and sales</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="production" name="Production (crates)" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="sales" name="Sales (crates)" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
