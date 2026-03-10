import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import AddExpenseDialog from "./dialogs/AddExpenseDialog";
import { useBranch } from "@/contexts/BranchContext";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 15;

const ExpensesTab = () => {
  const { currentBranchId } = useBranch();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});

  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let query = supabase
      .from("miscellaneous_expenses")
      .select("*, profiles(name), livestock_batches:batch_id(species, species_type)")
      .order("date", { ascending: false });

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data } = await query;

    if (data) {
      setExpenses(data);
      const uniqueCategories = Array.from(new Set(data.map(e => e.expense_type))).filter(Boolean) as string[];
      setAvailableCategories(uniqueCategories);
    }
  };

  useEffect(() => {
    let result = expenses;

    if (date?.from) {
      const fromD = startOfDay(date.from);
      const toD = date.to ? endOfDay(date.to) : endOfDay(date.from);
      result = result.filter((record) => {
        const recordDate = new Date(record.date);
        return isWithinInterval(recordDate, { start: fromD, end: toD });
      });
    }

    if (selectedCategory !== "all") {
      result = result.filter((e) => e.expense_type === selectedCategory);
    }

    setFilteredExpenses(result);

    const total = result.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    setTotalExpenses(total);

    const breakdown = result.reduce((acc, curr) => {
      acc[curr.expense_type] = (acc[curr.expense_type] || 0) + Number(curr.amount || 0);
      return acc;
    }, {} as Record<string, number>);
    setCategoryBreakdown(breakdown);

  }, [expenses, date, selectedCategory]);

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: filteredExpenses.length,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  const paginatedExpenses = filteredExpenses.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Expenses Management</h2>
          <p className="text-muted-foreground">Track all farm expenses ({filteredExpenses.length} filtered)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {availableCategories.length > 0 && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {availableCategories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

          <AddExpenseDialog onSuccess={fetchData} branchId={currentBranchId} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₦{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">from {filteredExpenses.length} expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₦{filteredExpenses.length > 0 ? Math.round(totalExpenses / filteredExpenses.length).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">per expense</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Expense Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {Object.keys(categoryBreakdown).length > 0
                ? Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0][0]
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Object.keys(categoryBreakdown).length > 0
                ? `₦${Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0][1].toLocaleString()}`
                : "No expenses"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses History</CardTitle>
          <CardDescription>Showing {paginatedExpenses.length} of {filteredExpenses.length} records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No expense records yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedExpenses.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{record.expense_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{record.description || "-"}</TableCell>
                    <TableCell>
                      {record.batch_id ? (
                        <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                          🐄 {record.livestock_batches?.species_type || record.livestock_batches?.species || "Batch"} Intake
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">General</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">₦{Number(record.amount).toLocaleString()}</TableCell>
                    <TableCell>{record.profiles?.name || "Unknown"}</TableCell>
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

export default ExpensesTab;
