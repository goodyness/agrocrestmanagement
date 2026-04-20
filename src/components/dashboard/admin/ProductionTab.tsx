import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";
import { BarChart3, Calendar as CalendarIcon, X } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import AddProductionDialog from "@/components/dashboard/worker/AddProductionDialog";
import BulkProductionDialog from "@/components/dashboard/worker/BulkProductionDialog";

const ITEMS_PER_PAGE = 15;

const ProductionTab = () => {
  const navigate = useNavigate();
  const { currentBranchId } = useBranch();
  const [production, setProduction] = useState<any[]>([]);
  const [filteredProduction, setFilteredProduction] = useState<any[]>([]);
  const [totalStats, setTotalStats] = useState({ totalCrates: 0, totalPieces: 0 });
  const [date, setDate] = useState<DateRange | undefined>();

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let query = supabase
      .from("daily_production")
      .select("*, profiles(name)")
      .order("date", { ascending: false });

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data } = await query;

    if (data) {
      setProduction(data);
    }
  };

  // Filter production based on date range
  useEffect(() => {
    let result = production;
    if (date?.from) {
      const fromD = startOfDay(date.from);
      const toD = date.to ? endOfDay(date.to) : endOfDay(date.from);

      result = production.filter((record) => {
        const recordDate = new Date(record.date);
        return isWithinInterval(recordDate, { start: fromD, end: toD });
      });
    }

    setFilteredProduction(result);

    // Calculate totals for currently filtered data
    const totals = result.reduce(
      (acc, curr) => ({
        totalCrates: acc.totalCrates + curr.crates,
        totalPieces: acc.totalPieces + curr.pieces,
      }),
      { totalCrates: 0, totalPieces: 0 }
    );

    // Normalize pieces if >= 30
    let finalCrates = totals.totalCrates;
    let finalPieces = totals.totalPieces;
    if (finalPieces >= 30) {
      finalCrates += Math.floor(finalPieces / 30);
      finalPieces = finalPieces % 30;
    }

    setTotalStats({ totalCrates: finalCrates, totalPieces: finalPieces });
  }, [production, date]);

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: filteredProduction.length,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  const paginatedProduction = filteredProduction.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Production Records</h2>
          <p className="text-muted-foreground">Daily egg production tracking ({filteredProduction.length} filtered)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[260px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Filter by date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {date?.from && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDate(undefined)}
                title="Clear date filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Button onClick={() => navigate("/analytics")} variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Production</CardTitle>
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
              {filteredProduction.length > 0 ? Math.round(totalStats.totalCrates / filteredProduction.length) : 0} crates
            </div>
            <p className="text-xs text-muted-foreground mt-1">per recorded day</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production History</CardTitle>
          <CardDescription>Showing {paginatedProduction.length} of {filteredProduction.length} records</CardDescription>
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
              {paginatedProduction.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No production records yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProduction.map((record) => (
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

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            getPageNumbers={getPageNumbers}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionTab;
