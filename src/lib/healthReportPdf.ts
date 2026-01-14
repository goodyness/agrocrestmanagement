import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subDays } from "date-fns";

interface MortalityRecord {
  date: string;
  quantity_dead: number;
  reason: string | null;
  livestock_categories?: { name: string } | null;
}

interface VaccinationRecord {
  administered_date: string;
  next_due_date: string;
  vaccination_types?: { name: string } | null;
  livestock_categories?: { name: string } | null;
}

interface FeedConsumption {
  date: string;
  quantity_used: number;
  unit: string;
  feed_types?: { feed_name: string } | null;
  livestock_categories?: { name: string } | null;
}

interface CensusData {
  total_count: number;
  updated_count: number;
  livestock_categories?: { name: string } | null;
}

interface ReportData {
  branchName: string;
  mortalityRecords: MortalityRecord[];
  vaccinationRecords: VaccinationRecord[];
  feedConsumption: FeedConsumption[];
  censusData: CensusData[];
  reportDate: Date;
}

export function generateHealthReportPdf(data: ReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(34, 139, 34); // Forest green
  doc.text("Agrocrest Farm", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Weekly Health Report", pageWidth / 2, 30, { align: "center" });
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Branch: ${data.branchName}`, pageWidth / 2, 38, { align: "center" });
  doc.text(
    `Report Period: ${format(subDays(data.reportDate, 7), "MMM dd, yyyy")} - ${format(data.reportDate, "MMM dd, yyyy")}`,
    pageWidth / 2,
    45,
    { align: "center" }
  );
  doc.text(`Generated: ${format(data.reportDate, "MMMM dd, yyyy 'at' h:mm a")}`, pageWidth / 2, 52, { align: "center" });

  let yPosition = 65;

  // Livestock Census Summary
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Livestock Census Summary", 14, yPosition);
  yPosition += 5;

  if (data.censusData.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [["Category", "Initial Count", "Current Count", "Change"]],
      body: data.censusData.map((c) => [
        c.livestock_categories?.name || "Unknown",
        c.total_count,
        c.updated_count,
        c.updated_count - c.total_count,
      ]),
      theme: "striped",
      headStyles: { fillColor: [34, 139, 34] },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.text("No census data available", 14, yPosition + 5);
    yPosition += 15;
  }

  // Mortality Records
  doc.setFontSize(14);
  doc.text("Mortality Records (Last 7 Days)", 14, yPosition);
  yPosition += 5;

  const weekAgo = subDays(data.reportDate, 7);
  const recentMortality = data.mortalityRecords.filter(
    (m) => new Date(m.date) >= weekAgo
  );

  if (recentMortality.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [["Date", "Category", "Deaths", "Reason"]],
      body: recentMortality.map((m) => [
        format(new Date(m.date), "MMM dd, yyyy"),
        m.livestock_categories?.name || "Unknown",
        m.quantity_dead,
        m.reason || "Not specified",
      ]),
      theme: "striped",
      headStyles: { fillColor: [220, 53, 69] },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.text("No mortality recorded in the last 7 days", 14, yPosition + 5);
    yPosition += 15;
  }

  // Check if we need a new page
  if (yPosition > 200) {
    doc.addPage();
    yPosition = 20;
  }

  // Vaccination Records
  doc.setFontSize(14);
  doc.text("Vaccination Records (Last 7 Days)", 14, yPosition);
  yPosition += 5;

  const recentVaccinations = data.vaccinationRecords.filter(
    (v) => new Date(v.administered_date) >= weekAgo
  );

  if (recentVaccinations.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [["Date", "Vaccine", "Category", "Next Due"]],
      body: recentVaccinations.map((v) => [
        format(new Date(v.administered_date), "MMM dd, yyyy"),
        v.vaccination_types?.name || "Unknown",
        v.livestock_categories?.name || "Unknown",
        format(new Date(v.next_due_date), "MMM dd, yyyy"),
      ]),
      theme: "striped",
      headStyles: { fillColor: [0, 123, 255] },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.text("No vaccinations administered in the last 7 days", 14, yPosition + 5);
    yPosition += 15;
  }

  // Check if we need a new page
  if (yPosition > 200) {
    doc.addPage();
    yPosition = 20;
  }

  // Feed Consumption Summary
  doc.setFontSize(14);
  doc.text("Feed Consumption Summary (Last 7 Days)", 14, yPosition);
  yPosition += 5;

  const recentFeed = data.feedConsumption.filter(
    (f) => new Date(f.date) >= weekAgo
  );

  // Aggregate feed by type
  const feedByType: Record<string, { quantity: number; unit: string }> = {};
  recentFeed.forEach((f) => {
    const name = f.feed_types?.feed_name || "Unknown";
    if (!feedByType[name]) {
      feedByType[name] = { quantity: 0, unit: f.unit };
    }
    feedByType[name].quantity += Number(f.quantity_used);
  });

  const feedData = Object.entries(feedByType).map(([name, data]) => [
    name,
    `${data.quantity.toFixed(2)} ${data.unit}`,
  ]);

  if (feedData.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [["Feed Type", "Total Consumed"]],
      body: feedData,
      theme: "striped",
      headStyles: { fillColor: [255, 193, 7] },
      styles: { textColor: [0, 0, 0] },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.text("No feed consumption recorded in the last 7 days", 14, yPosition + 5);
    yPosition += 15;
  }

  // Statistics Summary
  if (yPosition > 240) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(14);
  doc.text("Summary Statistics", 14, yPosition);
  yPosition += 10;

  const totalBirds = data.censusData.reduce((sum, c) => sum + c.updated_count, 0);
  const totalMortality = recentMortality.reduce((sum, m) => sum + m.quantity_dead, 0);
  const mortalityRate = totalBirds > 0 ? ((totalMortality / totalBirds) * 100).toFixed(2) : "0";

  doc.setFontSize(11);
  doc.text(`• Total Livestock: ${totalBirds}`, 20, yPosition);
  yPosition += 7;
  doc.text(`• Weekly Mortality: ${totalMortality} (${mortalityRate}% mortality rate)`, 20, yPosition);
  yPosition += 7;
  doc.text(`• Vaccinations Administered: ${recentVaccinations.length}`, 20, yPosition);
  yPosition += 7;
  doc.text(`• Feed Types Used: ${Object.keys(feedByType).length}`, 20, yPosition);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | Agrocrest Farm Management System`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `health-report-${data.branchName.toLowerCase()}-${format(data.reportDate, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
