import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";

const ProductionTab = () => {
  const { currentBranchId } = useBranch();
  const [production, setProduction] = useState<any[]>([]);
  const [totalStats, setTotalStats] = useState({ totalCrates: 0, totalPieces: 0 });

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let query = supabase
      .from("daily_production")
      .select("*, profiles(name)")
      .order("date", { ascending: false })
      .limit(30);

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data } = await query;

    if (data) {
      setProduction(data);
      const totals = data.reduce(
        (acc, curr) => ({
          totalCrates: acc.totalCrates + curr.crates,
          totalPieces: acc.totalPieces + curr.pieces,
        }),
        { totalCrates: 0, totalPieces: 0 }
      );
      setTotalStats(totals);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Production Records</h2>
        <p className="text-muted-foreground">Daily egg production tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Production (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalStats.totalCrates} crates</div>
            <p className="text-xs text-muted-foreground mt-1">{totalStats.totalPieces} pieces</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Daily Production</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {production.length > 0 ? Math.round(totalStats.totalCrates / production.length) : 0} crates
            </div>
            <p className="text-xs text-muted-foreground mt-1">per day</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Production Records</CardTitle>
          <CardDescription>Last 30 days of production data</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Crates</TableHead>
                <TableHead>Pieces</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {production.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No production records yet
                  </TableCell>
                </TableRow>
              ) : (
                production.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{record.crates}</TableCell>
                    <TableCell>{record.pieces}</TableCell>
                    <TableCell>{record.profiles?.name || "Unknown"}</TableCell>
                    <TableCell className="max-w-xs truncate">{record.comment || "-"}</TableCell>
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

export default ProductionTab;
