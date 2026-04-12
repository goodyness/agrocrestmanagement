import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Brain, TrendingUp, TrendingDown, Minus, Loader2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

interface Prediction {
  date: string;
  predicted_crates: number;
  confidence: string;
}

interface Forecast {
  predictions: Prediction[];
  factors: string[];
  trend: string;
  summary: string;
}

const ProductionForecast = () => {
  const { currentBranchId } = useBranch();
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState("14");

  const generateForecast = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("predict-production", {
        body: { branch_id: currentBranchId, days: parseInt(days) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForecast(data);
      toast.success("Forecast generated successfully!");
    } catch (err: any) {
      toast.error("Failed to generate forecast: " + (err.message || "Unknown error"));
    }
    setLoading(false);
  };

  const getTrendIcon = () => {
    if (!forecast) return null;
    switch (forecast.trend) {
      case "increasing": return <TrendingUp className="h-5 w-5 text-success" />;
      case "decreasing": return <TrendingDown className="h-5 w-5 text-destructive" />;
      default: return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const chartData = forecast?.predictions.map(p => ({
    date: new Date(p.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
    crates: p.predicted_crates,
    confidence: p.confidence,
  })) || [];

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Production Forecast
            </CardTitle>
            <CardDescription>AI-powered egg production predictions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generateForecast} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
              {loading ? "Analyzing..." : "Predict"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!forecast && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Click "Predict" to generate an AI-powered production forecast</p>
            <p className="text-xs mt-1">Uses historical data, flock age, and trends</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-muted-foreground">AI is analyzing your farm data...</p>
          </div>
        )}

        {forecast && !loading && (
          <div className="space-y-6">
            {/* Trend & Summary */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              {getTrendIcon()}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold capitalize">{forecast.trend} Trend</span>
                  <Badge variant={forecast.trend === "increasing" ? "default" : forecast.trend === "decreasing" ? "destructive" : "secondary"}>
                    {forecast.trend}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{forecast.summary}</p>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="crates" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" name="Predicted Crates" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Key Factors */}
            {forecast.factors.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Key Factors
                </h4>
                <ul className="space-y-1">
                  {forecast.factors.map((factor, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionForecast;
