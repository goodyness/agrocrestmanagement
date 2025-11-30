import { supabase } from "@/integrations/supabase/client";

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(","),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(",")
    )
  ].join("\n");

  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportProductionReport = async (startDate?: string, endDate?: string) => {
  const query = supabase
    .from("daily_production")
    .select("*, profiles(name)")
    .order("date", { ascending: false });

  if (startDate) query.gte("date", startDate);
  if (endDate) query.lte("date", endDate);

  const { data, error } = await query;

  if (error) {
    console.error("Export error:", error);
    throw error;
  }

  const exportData = data?.map(item => ({
    Date: item.date,
    Crates: item.crates,
    Pieces: item.pieces,
    Comment: item.comment || "",
    "Recorded By": item.profiles?.name || "",
    "Created At": new Date(item.created_at || "").toLocaleString(),
  }));

  exportToCSV(exportData || [], "production_report");
};

export const exportSalesReport = async (startDate?: string, endDate?: string) => {
  const query = supabase
    .from("sales_records")
    .select("*, profiles(name)")
    .order("date", { ascending: false });

  if (startDate) query.gte("date", startDate);
  if (endDate) query.lte("date", endDate);

  const { data, error } = await query;

  if (error) {
    console.error("Export error:", error);
    throw error;
  }

  const exportData = data?.map(item => ({
    Date: item.date,
    Product: item.product_name,
    Type: item.product_type,
    Quantity: item.quantity,
    Unit: item.unit,
    "Price/Unit": item.price_per_unit,
    "Total Amount": item.total_amount,
    Buyer: item.buyer_name || "",
    "Recorded By": item.profiles?.name || "",
  }));

  exportToCSV(exportData || [], "sales_report");
};

export const exportExpensesReport = async (startDate?: string, endDate?: string) => {
  const query = supabase
    .from("miscellaneous_expenses")
    .select("*, profiles(name)")
    .order("date", { ascending: false });

  if (startDate) query.gte("date", startDate);
  if (endDate) query.lte("date", endDate);

  const { data, error } = await query;

  if (error) {
    console.error("Export error:", error);
    throw error;
  }

  const exportData = data?.map(item => ({
    Date: item.date,
    Type: item.expense_type,
    Amount: item.amount,
    Description: item.description || "",
    "Created By": item.profiles?.name || "",
  }));

  exportToCSV(exportData || [], "expenses_report");
};

export const exportLivestockReport = async () => {
  const { data, error } = await supabase
    .from("livestock_census")
    .select("*, livestock_categories(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Export error:", error);
    throw error;
  }

  const exportData = data?.map(item => ({
    Category: item.livestock_categories?.name || "",
    "Initial Count": item.total_count,
    "Current Count": item.updated_count,
    "Created At": new Date(item.created_at || "").toLocaleString(),
    "Updated At": new Date(item.updated_at || "").toLocaleString(),
  }));

  exportToCSV(exportData || [], "livestock_report");
};
