import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

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

export const exportProductionReport = async (startDate?: string, endDate?: string, branchId?: string) => {
  let query = supabase
    .from("daily_production")
    .select("*, profiles(name)")
    .order("date", { ascending: false });

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);
  if (branchId) query = query.eq("branch_id", branchId);

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

export const exportSalesReport = async (startDate?: string, endDate?: string, branchId?: string) => {
  let query = supabase
    .from("sales_records")
    .select("*, profiles(name)")
    .order("date", { ascending: false });

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);
  if (branchId) query = query.eq("branch_id", branchId);

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

export const exportExpensesReport = async (startDate?: string, endDate?: string, branchId?: string) => {
  let query = supabase
    .from("miscellaneous_expenses")
    .select("*, profiles(name)")
    .order("date", { ascending: false });

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);
  if (branchId) query = query.eq("branch_id", branchId);

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

export const exportLivestockReport = async (startDate?: string, endDate?: string, branchId?: string) => {
  let query = supabase
    .from("livestock_census")
    .select("*, livestock_categories(name)")
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;

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

// Reconciliation export functions
interface ReconciliationData {
  id: string;
  period_start: string;
  period_end: string;
  opening_stock_crates: number;
  opening_stock_pieces: number;
  total_production_crates: number;
  total_production_pieces: number;
  total_sales_crates: number;
  total_sales_pieces: number;
  adjustment_crates: number;
  adjustment_pieces: number;
  closing_stock_crates: number;
  closing_stock_pieces: number;
  expected_closing_crates: number;
  expected_closing_pieces: number;
  status: string;
  notes: string | null;
}

interface AdjustmentData {
  adjustment_type: string;
  crates: number;
  pieces: number;
  description: string | null;
  created_at: string;
}

export const exportReconciliationToPDF = (
  reconciliation: ReconciliationData,
  adjustments: AdjustmentData[],
  branchName?: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text("Stock Reconciliation Report", pageWidth / 2, 20, { align: "center" });
  
  // Branch and period info
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  if (branchName) {
    doc.text(`Branch: ${branchName}`, 14, 35);
  }
  doc.text(
    `Period: ${format(new Date(reconciliation.period_start), "MMM d, yyyy")} - ${format(new Date(reconciliation.period_end), "MMM d, yyyy")}`,
    14,
    branchName ? 42 : 35
  );
  doc.text(`Status: ${reconciliation.status.toUpperCase()}`, 14, branchName ? 49 : 42);
  
  // Summary table
  const startY = branchName ? 58 : 51;
  autoTable(doc, {
    startY,
    head: [["Description", "Crates", "Pieces"]],
    body: [
      ["Opening Stock", reconciliation.opening_stock_crates.toString(), reconciliation.opening_stock_pieces.toString()],
      ["Production (+)", `+${reconciliation.total_production_crates}`, `+${reconciliation.total_production_pieces}`],
      ["Sales (-)", `-${reconciliation.total_sales_crates}`, `-${reconciliation.total_sales_pieces}`],
      ["Adjustments (-)", `-${reconciliation.adjustment_crates}`, `-${reconciliation.adjustment_pieces}`],
      ["Expected Closing", reconciliation.expected_closing_crates.toString(), reconciliation.expected_closing_pieces.toString()],
      ["Actual Closing", reconciliation.closing_stock_crates.toString(), reconciliation.closing_stock_pieces.toString()],
    ],
    theme: "striped",
    headStyles: { fillColor: [34, 139, 34] },
    styles: { fontSize: 10 },
  });
  
  // Adjustments table if any
  if (adjustments.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("Adjustments", 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [["Type", "Crates", "Pieces", "Description", "Date"]],
      body: adjustments.map(adj => [
        adj.adjustment_type,
        adj.crates.toString(),
        adj.pieces.toString(),
        adj.description || "-",
        format(new Date(adj.created_at), "MMM d, yyyy"),
      ]),
      theme: "striped",
      headStyles: { fillColor: [100, 100, 100] },
      styles: { fontSize: 9 },
    });
  }
  
  // Notes if any
  if (reconciliation.notes) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text("Notes:", 14, finalY);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    const splitNotes = doc.splitTextToSize(reconciliation.notes, pageWidth - 28);
    doc.text(splitNotes, 14, finalY + 7);
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on ${format(new Date(), "PPpp")}`, 14, footerY);
  doc.text("Agrocrest Farm Management System", pageWidth - 14, footerY, { align: "right" });
  
  // Download
  doc.save(`reconciliation_${format(new Date(reconciliation.period_start), "yyyy-MM-dd")}_to_${format(new Date(reconciliation.period_end), "yyyy-MM-dd")}.pdf`);
};

export const exportReconciliationToExcel = (
  reconciliation: ReconciliationData,
  adjustments: AdjustmentData[],
  branchName?: string
) => {
  // Create Excel-compatible CSV with multiple sections
  const lines: string[] = [];
  
  // Header
  lines.push("Stock Reconciliation Report");
  lines.push(`Branch,${branchName || "All Branches"}`);
  lines.push(`Period,${format(new Date(reconciliation.period_start), "MMM d, yyyy")} - ${format(new Date(reconciliation.period_end), "MMM d, yyyy")}`);
  lines.push(`Status,${reconciliation.status.toUpperCase()}`);
  lines.push("");
  
  // Summary section
  lines.push("SUMMARY");
  lines.push("Description,Crates,Pieces");
  lines.push(`Opening Stock,${reconciliation.opening_stock_crates},${reconciliation.opening_stock_pieces}`);
  lines.push(`Production (+),+${reconciliation.total_production_crates},+${reconciliation.total_production_pieces}`);
  lines.push(`Sales (-),-${reconciliation.total_sales_crates},-${reconciliation.total_sales_pieces}`);
  lines.push(`Adjustments (-),-${reconciliation.adjustment_crates},-${reconciliation.adjustment_pieces}`);
  lines.push(`Expected Closing,${reconciliation.expected_closing_crates},${reconciliation.expected_closing_pieces}`);
  lines.push(`Actual Closing,${reconciliation.closing_stock_crates},${reconciliation.closing_stock_pieces}`);
  lines.push("");
  
  // Adjustments section
  if (adjustments.length > 0) {
    lines.push("ADJUSTMENTS");
    lines.push("Type,Crates,Pieces,Description,Date");
    adjustments.forEach(adj => {
      lines.push(`${adj.adjustment_type},${adj.crates},${adj.pieces},"${adj.description || "-"}",${format(new Date(adj.created_at), "MMM d, yyyy")}`);
    });
    lines.push("");
  }
  
  // Notes
  if (reconciliation.notes) {
    lines.push("NOTES");
    lines.push(`"${reconciliation.notes.replace(/"/g, '""')}"`);
  }
  
  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `reconciliation_${format(new Date(reconciliation.period_start), "yyyy-MM-dd")}_to_${format(new Date(reconciliation.period_end), "yyyy-MM-dd")}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
