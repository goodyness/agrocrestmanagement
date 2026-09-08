import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import BatchSalesTab from "./BatchSalesTab";
import { buildClosureReportPdf, ClosureSaleLine } from "@/lib/batchClosureReportPdf";

interface Props {
  batch: any;
  onBack: () => void;
  onClosed?: () => void;
}

const money = (n: number) => "₦" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const STEPS = ["Expenses", "Survival & sales", "Closing sales", "Report"];

export default function BatchClosureWizard({ batch, onBack, onClosed }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [mortality, setMortality] = useState(0);
  const [projection, setProjection] = useState<any>(null);
  const [partnerLink, setPartnerLink] = useState<any>(null);
  const [branchName, setBranchName] = useState<string>("");
  const [existing, setExisting] = useState<any>(null);
  const [me, setMe] = useState<{ id: string; name: string; email: string } | null>(null);

  const [expenseNote, setExpenseNote] = useState("");
  const [purchaseCost, setPurchaseCost] = useState(String(Number(batch?.total_cost || 0)));
  const [otherCost, setOtherCost] = useState("0");
  const [survived, setSurvived] = useState(String(Number(batch?.current_quantity || 0)));
  const [lines, setLines] = useState<ClosureSaleLine[]>([]);
  const [reportNote, setReportNote] = useState("");

  const batchLabel = `${batch?.species_type || batch?.species || "Batch"} • ${new Date(batch?.date_acquired || batch?.created_at).toLocaleDateString("en-GB")}`;

  const load = async () => {
    setLoading(true);
    const [{ data: exp }, { data: sal }, { data: mort }, { data: proj }, { data: closure }, { data: pb }] = await Promise.all([
      supabase.from("miscellaneous_expenses").select("*, profiles:created_by(name)").eq("batch_id", batch.id).order("date"),
      supabase.from("batch_sales").select("*").eq("batch_id", batch.id).order("sale_date"),
      supabase.from("mortality_records").select("quantity_dead").eq("batch_id", batch.id),
      supabase.from("batch_projections").select("*").eq("batch_id", batch.id).maybeSingle(),
      supabase.from("batch_closures").select("*").eq("batch_id", batch.id).maybeSingle(),
      supabase.from("partner_batches").select("*, partners(phone, profiles:profile_id(name, email))").eq("batch_id", batch.id).maybeSingle(),
    ]);
    setExpenses(exp || []);
    setSales(sal || []);
    setMortality((mort || []).reduce((s: number, m: any) => s + Number(m.quantity_dead || 0), 0));
    setProjection(proj);
    setExisting(closure);
    setPartnerLink(pb);

    if (batch.branch_id) {
      const { data: br } = await supabase.from("branches").select("name").eq("id", batch.branch_id).maybeSingle();
      setBranchName(br?.name || "");
    }

    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { data: p } = await supabase.from("profiles").select("name, email").eq("id", auth.user.id).maybeSingle();
      setMe({ id: auth.user.id, name: p?.name || auth.user.email || "", email: p?.email || auth.user.email || "" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [batch.id]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const soldBirds = lines.reduce((s, l) => s + Number(l.birds || 0), 0);
  const survivedNum = Number(survived || 0);
  const tallies = soldBirds === survivedNum;

  const addLine = (mode: "live" | "kg") =>
    setLines((prev) => [...prev, mode === "live"
      ? { mode, birds: 0, price_per_bird: 0, amount: 0 }
      : { mode, birds: 0, kg: 0, price_per_kg: 0, amount: 0 }]);

  const updateLine = (i: number, patch: Partial<ClosureSaleLine>) =>
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      const n = { ...l, ...patch } as ClosureSaleLine;
      n.amount = n.mode === "live"
        ? Number(n.birds || 0) * Number(n.price_per_bird || 0)
        : Number(n.kg || 0) * Number(n.price_per_kg || 0);
      return n;
    }));

  const reportData = () => ({
    batchLabel,
    branchName,
    dateAcquired: batch?.date_acquired,
    ageWeeks: batch?.age_weeks,
    weeksToRaise: projection?.weeks_to_raise ?? null,
    partnerName: partnerLink?.partners?.profiles?.name || null,
    partnerSharePct: partnerLink ? Number(partnerLink.profit_share_percentage ?? partnerLink.share_percentage ?? 0) : null,
    initialBirds: Number(batch?.quantity || 0),
    survivedBirds: survivedNum,
    mortalityCount: mortality,
    purchaseCost: Number(purchaseCost || 0),
    otherCost: Number(otherCost || 0),
    expenses: expenses.map((e) => ({
      date: e.date,
      expense_type: e.expense_type,
      description: e.description,
      amount: Number(e.amount || 0),
      recorded_by: e.profiles?.name || null,
    })),
    expenseNote: expenseNote || null,
    sales: sales.map((s) => ({
      sale_date: s.sale_date,
      product_name: s.product_name,
      quantity: Number(s.quantity || 0),
      unit: s.unit,
      unit_price: Number(s.unit_price || 0),
      total_amount: Number(s.total_amount || 0),
      buyer: s.buyer,
    })),
    saleLines: lines,
    reportNote: reportNote || null,
    submittedBy: me?.name || null,
    submittedAt: new Date().toISOString(),
  });

  const previewTotals = buildClosureReportPdf(reportData()).totals;

  const submit = async () => {
    setSaving(true);
    try {
      const data = reportData();
      const { doc, totals } = buildClosureReportPdf(data);

      const { error } = await supabase.from("batch_closures").insert({
        batch_id: batch.id,
        expense_note: expenseNote || null,
        expenses_snapshot: data.expenses as any,
        purchase_cost: Number(purchaseCost || 0),
        other_cost: Number(otherCost || 0),
        initial_birds: Number(batch?.quantity || 0),
        survived_birds: survivedNum,
        sale_lines: lines as any,
        sales_snapshot: data.sales as any,
        totals: totals as any,
        report_note: reportNote || null,
        submitted_by: me?.id || null,
      });
      if (error) throw error;

      await supabase
        .from("livestock_batches")
        .update({ production_closed_at: new Date().toISOString(), production_closed_by: me?.id || null, is_active: false })
        .eq("id", batch.id);

      const fileName = `closure-${(batch?.species_type || batch?.species || "batch")}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);

      const base64 = (doc.output("datauristring") as string).split(",")[1];
      const recipients = [partnerLink?.partners?.profiles?.email, me?.email].filter(Boolean);
      const summaryHtml = `
        <ul style="font-size:14px;line-height:1.7">
          <li>Total cost: ₦${totals.totalCost.toLocaleString()}</li>
          <li>Total revenue: ₦${totals.revenue.toLocaleString()}</li>
          <li>${totals.profit >= 0 ? "Profit" : "Loss"}: ₦${Math.abs(totals.profit).toLocaleString()}</li>
          <li>Survival: ${totals.survivalRate.toFixed(1)}% (mortality ${totals.mortalityRate.toFixed(1)}%)</li>
        </ul>`;

      const { error: mailErr } = await supabase.functions.invoke("send-closure-report", {
        body: { batchLabel, summaryHtml, recipients, pdfBase64: base64, fileName },
      });
      if (mailErr) toast.warning("Report saved, but the email could not be sent.");
      else toast.success("Cycle closed. Report downloaded and emailed.");

      onClosed?.();
      onBack();
    } catch (e: any) {
      toast.error(e.message || "Could not close this production cycle");
    } finally {
      setSaving(false);
    }
  };

  const downloadExisting = () => {
    const c = existing;
    const { doc } = buildClosureReportPdf({
      batchLabel,
      branchName,
      dateAcquired: batch?.date_acquired,
      ageWeeks: batch?.age_weeks,
      weeksToRaise: projection?.weeks_to_raise ?? null,
      partnerName: partnerLink?.partners?.profiles?.name || null,
      partnerSharePct: partnerLink ? Number(partnerLink.profit_share_percentage ?? partnerLink.share_percentage ?? 0) : null,
      initialBirds: Number(c.initial_birds || 0),
      survivedBirds: Number(c.survived_birds || 0),
      mortalityCount: mortality,
      purchaseCost: Number(c.purchase_cost || 0),
      otherCost: Number(c.other_cost || 0),
      expenses: (c.expenses_snapshot || []) as any,
      expenseNote: c.expense_note,
      sales: (c.sales_snapshot || []) as any,
      saleLines: (c.sale_lines || []) as any,
      reportNote: c.report_note,
      submittedBy: null,
      submittedAt: c.submitted_at,
    });
    doc.save("closure-report.pdf");
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  if (existing) {
    const t = (existing.totals || {}) as any;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back to batch</Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-green-600" /> Production cycle closed</CardTitle>
            <CardDescription>
              Submitted on {new Date(existing.submitted_at).toLocaleString("en-GB")}. This report can be viewed but not edited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Total cost", money(t.totalCost || 0)],
                ["Total revenue", money(t.revenue || 0)],
                [(t.profit || 0) >= 0 ? "Profit" : "Loss", money(Math.abs(t.profit || 0))],
                ["Survived", `${existing.survived_birds} / ${existing.initial_birds}`],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-semibold">{v}</p>
                </div>
              ))}
            </div>
            {existing.expense_note && <p className="text-sm"><b>Expense note:</b> {existing.expense_note}</p>}
            {existing.report_note && <p className="text-sm"><b>Closing note:</b> {existing.report_note}</p>}
            <Button onClick={downloadExisting}><Download className="h-4 w-4 mr-1" /> Download report</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back to batch</Button>
        <div className="flex gap-1 flex-wrap">
          {STEPS.map((s, i) => (
            <Badge key={s} variant={i === step ? "default" : i < step ? "secondary" : "outline"} className="text-xs">
              {i + 1}. {s}
            </Badge>
          ))}
        </div>
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review all expenses</CardTitle>
            <CardDescription>Check every cost recorded for this batch. If anything is missing or wrong, write it in the note below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>What was bought</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No expenses recorded</TableCell></TableRow>
                  ) : expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{new Date(e.date).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell className="capitalize">{e.expense_type || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.description?.trim() ? e.description : "Nil"}</TableCell>
                      <TableCell>{e.profiles?.name || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{money(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total recorded expenses</p>
                <p className="font-semibold">{money(totalExpenses)}</p>
              </div>
              <div>
                <Label className="text-xs">Purchase cost (stock)</Label>
                <Input type="number" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Other cost</Label>
                <Input type="number" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Note (missing record or mistake) — optional</Label>
              <Textarea value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="e.g. one feed purchase of ₦40,000 was not recorded" />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)}>Proceed — expenses are correct</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How many survived?</CardTitle>
              <CardDescription>
                Started with {Number(batch?.quantity || 0)} • recorded mortality {mortality} • current system count {Number(batch?.current_quantity || 0)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-w-xs">
                <Label className="text-xs">Number that survived</Label>
                <Input type="number" value={survived} onChange={(e) => setSurvived(e.target.value)} />
              </div>
              <p className="text-sm text-muted-foreground">
                Below is every sale already attached to this batch. Add anything missing before continuing.
              </p>
            </CardContent>
          </Card>

          <BatchSalesTab batch={batch} onChange={load} />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => setStep(2)} disabled={survivedNum <= 0}>Proceed — sales are correct</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How were the {survivedNum} surviving birds sold?</CardTitle>
            <CardDescription>Only two units are allowed: per live bird, or per kg. Add as many lines as you need — the bird count must tally.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{l.mode === "live" ? "Per live bird" : "Per kg"}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => setLines((p) => p.filter((_, x) => x !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Number of birds</Label>
                    <Input type="number" value={l.birds || ""} onChange={(e) => updateLine(i, { birds: Number(e.target.value) })} />
                  </div>
                  {l.mode === "live" ? (
                    <div>
                      <Label className="text-xs">Price per bird</Label>
                      <Input type="number" value={l.price_per_bird || ""} onChange={(e) => updateLine(i, { price_per_bird: Number(e.target.value) })} />
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs">Total kg</Label>
                        <Input type="number" value={l.kg || ""} onChange={(e) => updateLine(i, { kg: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Price per kg</Label>
                        <Input type="number" value={l.price_per_kg || ""} onChange={(e) => updateLine(i, { price_per_kg: Number(e.target.value) })} />
                      </div>
                    </>
                  )}
                </div>
                <p className="text-sm font-medium">Line total: {money(l.amount)}</p>
              </div>
            ))}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => addLine("live")}><Plus className="h-4 w-4 mr-1" /> Sold per live bird</Button>
              <Button variant="outline" size="sm" onClick={() => addLine("kg")}><Plus className="h-4 w-4 mr-1" /> Sold per kg</Button>
            </div>

            <div className={`rounded-lg border p-3 text-sm ${tallies ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
              {tallies ? (
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> {soldBirds} birds accounted for — tallies with survivors.</span>
              ) : (
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> {soldBirds} accounted for vs {survivedNum} survivors. You can continue, but the mismatch will be noted in the report.</span>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Continue to report</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Final report</CardTitle>
            <CardDescription>Review the numbers, then close the cycle. The PDF is downloaded and emailed to you{partnerLink ? " and the partner" : ""}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Total cost", money(previewTotals.totalCost)],
                ["Total revenue", money(previewTotals.revenue)],
                [previewTotals.profit >= 0 ? "Profit" : "Loss", money(Math.abs(previewTotals.profit))],
                ["Mortality rate", `${previewTotals.mortalityRate.toFixed(1)}%`],
                ["Survival rate", `${previewTotals.survivalRate.toFixed(1)}%`],
                ["Cost per bird", money(previewTotals.costPerBird)],
                ["Revenue per bird sold", money(previewTotals.revenuePerBird)],
                ["Balance check", previewTotals.balanced ? "Balanced" : "Mismatch noted"],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-semibold">{v}</p>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs">Closing note (optional)</Label>
              <Textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} placeholder="Anything worth recording about this cycle" />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Close production & generate report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
