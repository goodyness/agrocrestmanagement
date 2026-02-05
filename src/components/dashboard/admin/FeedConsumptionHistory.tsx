import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ConsumptionRecord {
  id: string;
  date: string;
  quantity_used: number;
  unit: string;
  feed_types: { feed_name: string } | null;
  livestock_categories: { name: string } | null;
  profiles: { name: string } | null;
}

const FeedConsumptionHistory = () => {
  const { currentBranchId } = useBranch();
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [feedTypes, setFeedTypes] = useState<any[]>([]);
  const [selectedFeedType, setSelectedFeedType] = useState<string>("all");
  const [daysRange, setDaysRange] = useState<string>("30");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedTypes();
  }, [currentBranchId]);

  useEffect(() => {
    fetchConsumptionData();
  }, [currentBranchId, selectedFeedType, daysRange]);

  const fetchFeedTypes = async () => {
    let query = supabase.from("feed_types").select("id, feed_name");
    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }
    const { data } = await query;
    if (data) setFeedTypes(data);
  };

  const fetchConsumptionData = async () => {
    setLoading(true);
    const days = parseInt(daysRange);
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

    let query = supabase
      .from("feed_consumption")
      .select("*, feed_types(feed_name), livestock_categories(name), profiles(name)")
      .gte("date", startDate)
      .order("date", { ascending: false });

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    if (selectedFeedType !== "all") {
      query = query.eq("feed_type_id", selectedFeedType);
    }

    const { data } = await query;

    if (data) {
      setRecords(data as ConsumptionRecord[]);
      
      // Aggregate data by date for chart
      const aggregated: { [key: string]: { date: string; total: number; [key: string]: any } } = {};
      
      data.forEach((record: any) => {
        const dateKey = record.date;
        if (!aggregated[dateKey]) {
          aggregated[dateKey] = { date: dateKey, total: 0 };
        }
        
        // Convert to kg for consistency (assuming 1 bag = 25kg)
        let quantityInKg = record.quantity_used;
        if (record.unit === 'bags') {
          quantityInKg = record.quantity_used * 25;
        }
        
        aggregated[dateKey].total += quantityInKg;
        
        // Also track by feed type
        const feedName = record.feed_types?.feed_name || 'Unknown';
        if (!aggregated[dateKey][feedName]) {
          aggregated[dateKey][feedName] = 0;
        }
        aggregated[dateKey][feedName] += quantityInKg;
      });

      const chartArray = Object.values(aggregated)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setChartData(chartArray);
    }

    setLoading(false);
  };

  const totalConsumption = records.reduce((acc, curr) => {
    let qty = curr.quantity_used;
    if (curr.unit === 'bags') qty *= 25;
    return acc + qty;
  }, 0);

  const avgDailyConsumption = chartData.length > 0 
    ? (totalConsumption / chartData.length).toFixed(1) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Feed Consumption History</h3>
          <p className="text-sm text-muted-foreground">Track daily feed usage patterns</p>
        </div>
        <div className="flex gap-2">
          <Select value={daysRange} onValueChange={setDaysRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedFeedType} onValueChange={setSelectedFeedType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All feed types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All feed types</SelectItem>
              {feedTypes.map((ft) => (
                <SelectItem key={ft.id} value={ft.id}>{ft.feed_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConsumption.toFixed(1)} kg</div>
            <p className="text-xs text-muted-foreground">in last {daysRange} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDailyConsumption} kg</div>
            <p className="text-xs text-muted-foreground">per day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
            <p className="text-xs text-muted-foreground">consumption entries</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Consumption Trend</CardTitle>
            <CardDescription>Feed usage over time (in kg)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), "MMM dd")}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy")}
                    formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Consumption']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                    name="Total (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Consumption Records</CardTitle>
          <CardDescription>Detailed feed usage log</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Feed Type</TableHead>
                <TableHead>Livestock</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No consumption records found
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{record.feed_types?.feed_name || "-"}</TableCell>
                    <TableCell>{record.livestock_categories?.name || "-"}</TableCell>
                    <TableCell>{record.quantity_used} {record.unit}</TableCell>
                    <TableCell>{record.profiles?.name || "Unknown"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedConsumptionHistory;
