import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ClosureExpense {
  date: string;
  expense_type?: string | null;
  description?: string | null;
  amount: number;
  recorded_by?: string | null;
}

export interface ClosureSaleLine {
  mode: "live" | "kg";
  birds: number;
  price_per_bird?: number;
  kg?: number;
  price_per_kg?: number;
  amount: number;
}

export interface ClosureSale {
  sale_date: string;
  product_name?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  total_amount: number;
  buyer?: string | null;
}

export interface ClosureReportData {
  batchLabel: string;
  branchName?: string | null;
  dateAcquired?: string | null;
  ageWeeks?: number | null;
  weeksToRaise?: number | null;
  partnerName?: string | null;
  partnerSharePct?: number | null;
  initialBirds: number;
  survivedBirds: number;
  mortalityCount: number;
  purchaseCost: number;
  otherCost: number;
  expenses: ClosureExpense[];
  expenseNote?: string | null;
  sales: ClosureSale[];
  saleLines: ClosureSaleLine[];
  reportNote?: string | null;
  submittedBy?: string | null;
  submittedAt: string;
}

const money = (n: number) => "N" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const dt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");

const GREEN: [number, number, number] = [34, 110, 60];

export function buildClosureReportPdf(d: ClosureReportData) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text("Agrocrest Farm", 14, 13);
  doc.setFontSize(11);
  doc.text("Production Cycle Closure Report", 14, 22);
  doc.setFontSize(9);
  doc.text(new Date(d.submittedAt).toLocaleString("en-GB"), W - 14, 22, { align: "right" });

  doc.setTextColor(0, 0, 0);

  const totalExpenses = d.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalCost = totalExpenses + Number(d.purchaseCost || 0) + Number(d.otherCost || 0);
  const salesRevenue = d.sales.reduce((s, x) => s + Number(x.total_amount || 0), 0);
  const closureRevenue = d.saleLines.reduce((s, x) => s + Number(x.amount || 0), 0);
  const revenue = salesRevenue + closureRevenue;
  const profit = revenue - totalCost;
  const soldBirds = d.saleLines.reduce((s, x) => s + Number(x.birds || 0), 0);
  const mortalityRate = d.initialBirds > 0 ? (d.mortalityCount / d.initialBirds) * 100 : 0;
  const survivalRate = d.initialBirds > 0 ? (d.survivedBirds / d.initialBirds) * 100 : 0;
  const costPerBird = d.initialBirds > 0 ? totalCost / d.initialBirds : 0;
  const revenuePerBird = soldBirds > 0 ? revenue / soldBirds : 0;
  const balanced = soldBirds === d.survivedBirds;

  autoTable(doc, {
    startY: 36,
    theme: "grid",
    headStyles: { fillColor: GREEN },
    head: [["Batch summary", ""]],
    body: [
      ["Batch", d.batchLabel],
      ["Branch", d.branchName || "-"],
      ["Date acquired", dt(d.dateAcquired)],
      ["Age at closure", `${d.ageWeeks ?? "-"} weeks${d.weeksToRaise ? ` (planned ${d.weeksToRaise})` : ""}`],
      ["Partner", d.partnerName ? `${d.partnerName}${d.partnerSharePct ? ` (${d.partnerSharePct}% profit share)` : ""}` : "None"],
      ["Submitted by", d.submittedBy || "-"],
    ],
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    theme: "grid",
    headStyles: { fillColor: GREEN },
    head: [["Flock performance", ""]],
    body: [
      ["Birds/animals at intake", String(d.initialBirds)],
      ["Recorded mortality", `${d.mortalityCount} (${mortalityRate.toFixed(1)}%)`],
      ["Survived at closure", `${d.survivedBirds} (${survivalRate.toFixed(1)}% survival)`],
      ["Accounted for in closing sales", String(soldBirds)],
      ["Tally check", balanced ? "Balanced" : `MISMATCH: ${soldBirds} sold vs ${d.survivedBirds} survived`],
    ],
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });

  // Expenses
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    theme: "striped",
    headStyles: { fillColor: GREEN },
    head: [["Date", "What was bought", "Note", "Recorded by", "Amount"]],
    body: d.expenses.length
      ? d.expenses.map((e) => [
          dt(e.date),
          e.expense_type || "-",
          e.description && e.description.trim() ? e.description : "Nil",
          e.recorded_by || "-",
          money(Number(e.amount || 0)),
        ])
      : [["-", "No expenses recorded", "Nil", "-", money(0)]],
    foot: [["", "", "", "Total expenses", money(totalExpenses)]],
    footStyles: { fillColor: [235, 240, 235], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 8 },
  });

  if (d.expenseNote) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      theme: "plain",
      body: [[`Note on expense record: ${d.expenseNote}`]],
      styles: { fontSize: 8, textColor: [150, 60, 0] },
    });
  }

  // Expense breakdown chart (simple bars)
  const byType: Record<string, number> = {};
  d.expenses.forEach((e) => {
    const k = e.expense_type || "Other";
    byType[k] = (byType[k] || 0) + Number(e.amount || 0);
  });
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length) {
    let y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(...GREEN);
    doc.text("Expense breakdown", 14, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    const max = Math.max(...entries.map((e) => e[1]));
    const barMax = 100;
    entries.forEach(([k, v]) => {
      doc.setFontSize(8);
      doc.text(k.slice(0, 22), 14, y + 4);
      doc.setFillColor(...GREEN);
      doc.rect(60, y, Math.max(1, (v / max) * barMax), 5, "F");
      doc.text(`${money(v)} (${totalExpenses ? ((v / totalExpenses) * 100).toFixed(1) : "0"}%)`, 60 + barMax + 4, y + 4);
      y += 8;
    });
  }

  // Sales
  doc.addPage();
  doc.setFontSize(13);
  doc.setTextColor(...GREEN);
  doc.text("Sales", 14, 18);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 22,
    theme: "striped",
    headStyles: { fillColor: GREEN },
    head: [["Date", "Product", "Qty", "Unit", "Unit price", "Buyer", "Total"]],
    body: d.sales.length
      ? d.sales.map((s) => [
          dt(s.sale_date),
          s.product_name || "-",
          String(s.quantity),
          s.unit || "-",
          money(Number(s.unit_price || 0)),
          s.buyer || "-",
          money(Number(s.total_amount || 0)),
        ])
      : [["-", "No sales recorded during the cycle", "", "", "", "", money(0)]],
    foot: [["", "", "", "", "", "Sales during cycle", money(salesRevenue)]],
    footStyles: { fillColor: [235, 240, 235], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 8 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    theme: "grid",
    headStyles: { fillColor: GREEN },
    head: [["Closing sales", "Birds", "Kg", "Price", "Amount"]],
    body: d.saleLines.length
      ? d.saleLines.map((l) => [
          l.mode === "live" ? "Sold per live bird" : "Sold per kg",
          String(l.birds),
          l.mode === "kg" ? String(l.kg ?? 0) : "-",
          l.mode === "live" ? `${money(l.price_per_bird || 0)}/bird` : `${money(l.price_per_kg || 0)}/kg`,
          money(l.amount),
        ])
      : [["No closing sale lines", "0", "-", "-", money(0)]],
    foot: [["Total", String(soldBirds), "", "", money(closureRevenue)]],
    footStyles: { fillColor: [235, 240, 235], textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 8 },
  });

  // Financial summary
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    theme: "grid",
    headStyles: { fillColor: GREEN },
    head: [["Financial summary", ""]],
    body: [
      ["Purchase cost (stock)", money(d.purchaseCost)],
      ["Recorded expenses", money(totalExpenses)],
      ["Other closing costs", money(d.otherCost)],
      ["Total cost", money(totalCost)],
      ["Revenue during cycle", money(salesRevenue)],
      ["Revenue at closing", money(closureRevenue)],
      ["Total revenue", money(revenue)],
      [profit >= 0 ? "PROFIT" : "LOSS", money(Math.abs(profit))],
      ["Cost per bird at intake", money(costPerBird)],
      ["Revenue per bird sold", money(revenuePerBird)],
      ["Report balance", balanced ? "Balanced - bird count tallies" : "Not balanced - bird count mismatch noted above"],
    ],
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold" } },
  });

  if (d.partnerName && d.partnerSharePct) {
    const share = profit > 0 ? (profit * d.partnerSharePct) / 100 : 0;
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      theme: "grid",
      headStyles: { fillColor: GREEN },
      head: [["Partner settlement", ""]],
      body: [
        ["Partner", d.partnerName],
        ["Profit share", `${d.partnerSharePct}%`],
        ["Partner share of profit", money(share)],
        ["Farm share", money(profit > 0 ? profit - share : 0)],
      ],
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 70, fontStyle: "bold" } },
    });
  }

  if (d.reportNote) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      theme: "plain",
      body: [[`Closing note: ${d.reportNote}`]],
      styles: { fontSize: 9 },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Agrocrest Farm - closure report - page ${i} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
  }

  return {
    doc,
    totals: {
      totalExpenses,
      totalCost,
      salesRevenue,
      closureRevenue,
      revenue,
      profit,
      soldBirds,
      mortalityRate,
      survivalRate,
      costPerBird,
      revenuePerBird,
      balanced,
    },
  };
}
