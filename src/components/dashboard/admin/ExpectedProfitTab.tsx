import { useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarIcon, Plus, TrendingUp, TrendingDown, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/activityLogger";

const PIECES_PER_CRATE = 30;

interface Batch {
  id: string;
  species: string;
  species_type: string | null;
  stage: string | null;
  current_quantity: number;
  branch_id: string | null;
  livestock_category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  branch_id: string | null;
}

interface Monitor {
  id: string;
  name: string;
  batch_id: string | null;
  branch_id: string | null;
  livestock_category_id: string | null;
  bird_count: number;
  bags_per_day: number;
  price_per_bag: number;
  fallback_price_per_crate: number;
  fallback_price_per_piece: number;
  start_date: string;
  end_date: string;
  baseline_crates: number;
  baseline_pieces: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: "",
  batch_id: "none",
  livestock_category_id: "none",
  bird_count: "",
  bags_per_day: "1.5",
  price_per_bag: "15300",
  fallback_price_per_crate: "",
  fallback_price_per_piece: "",
  start_date: new Date(),
  end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  baseline_crates: "0",
  baseline_pieces: "0",
  notes: "",
};

export default function ExpectedProfitTab() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(!!data);
    })();
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [m, b, c, p, s, e] = await Promise.all([
      supabase.from("profit_monitors").select("*").order("created_at", { ascending: false }),
      supabase.from("livestock_batches").select("id, species, species_type, stage, current_quantity, branch_id, livestock_category_id").eq("is_active", true),
      supabase.from("livestock_categories").select("id, name, branch_id"),
      supabase.from("daily_production").select("date, crates, pieces, branch_id"),
      supabase.from("sales_records").select("date, product_type, quantity, unit, total_amount, price_per_unit, branch_id"),
      supabase.from("miscellaneous_expenses").select("date, amount, branch_id, batch_id, expense_type"),
    ]);
    setMonitors((m.data as Monitor[]) || []);
    setBatches((b.data as Batch[]) || []);
    setCategories((c.data as Category[]) || []);
    setProduction(p.data || []);
    setSales(s.data || []);
    setExpenses(e.data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const bird = parseInt(form.bird_count);
    const bags = parseFloat(form.bags_per_day);
    const ppb = parseFloat(form.price_per_bag);
    const fpc = parseFloat(form.fallback_price_per_crate || "0");
    const fpp = parseFloat(form.fallback_price_per_piece || "0");
    const bcr = parseInt(form.baseline_crates || "0");
    const bpc = parseInt(form.baseline_pieces || "0");

    if (isNaN(bird) || bird < 0) return toast.error("Invalid bird count");
    if (isNaN(bags) || bags < 0) return toast.error("Invalid bags/day");
    if (isNaN(ppb) || ppb < 0) return toast.error("Invalid price per bag");
    if (fpc < 0 || fpp < 0) return toast.error("Fallback prices cannot be negative");
    if (bpc < 0 || bpc >= PIECES_PER_CRATE) return toast.error("Baseline pieces must be 0–29");
    if (bcr < 0) return toast.error("Baseline crates cannot be negative");
    if (form.end_date <= form.start_date) return toast.error("End date must be after start");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Not authenticated");

    const batch = batches.find((b) => b.id === form.batch_id);

    const payload = {
      name: form.name.trim(),
      batch_id: form.batch_id === "none" ? null : form.batch_id,
      branch_id: batch?.branch_id ?? null,
      livestock_category_id:
        form.livestock_category_id === "none"
          ? batch?.livestock_category_id ?? null
          : form.livestock_category_id,
      bird_count: bird,
      bags_per_day: bags,
      price_per_bag: ppb,
      fallback_price_per_crate: fpc,
      fallback_price_per_piece: fpp,
      start_date: format(form.start_date, "yyyy-MM-dd"),
      end_date: format(form.end_date, "yyyy-MM-dd"),
      baseline_crates: bcr,
      baseline_pieces: bpc,
      notes: form.notes.trim() || null,
      created_by: user.id,
    };

    const { data, error } = await supabase.from("profit_monitors").insert([payload]).select().single();
    if (error) return toast.error(error.message);

    await logActivity("create", "profit_monitor", data.id, { name: payload.name }, payload.branch_id);
    toast.success("Profit monitor created");
    setOpen(false);
    setForm(emptyForm);
    loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this profit monitor?")) return;
    const { error } = await supabase.from("profit_monitors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "profit_monitor", id);
    toast.success("Deleted");
    loadAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Expected Profit
          </h2>
          <p className="text-sm text-muted-foreground">
            Track feed cost vs egg revenue & expenses to see live profit per batch.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> New Profit Monitor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Profit Monitor</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="e.g. Layers Batch A — May–June"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Linked Batch (optional)</Label>
                  <Select
                    value={form.batch_id}
                    onValueChange={(v) => {
                      const b = batches.find((x) => x.id === v);
                      setForm({
                        ...form,
                        batch_id: v,
                        bird_count: b ? String(b.current_quantity) : form.bird_count,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.species}{b.species_type ? ` (${b.species_type})` : ""} • {b.current_quantity} birds
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Animal Category (optional)</Label>
                  <Select
                    value={form.livestock_category_id}
                    onValueChange={(v) => setForm({ ...form, livestock_category_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="From batch" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— From batch —</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Number of Laying Birds *</Label>
                  <Input type="number" min={0} value={form.bird_count}
                    onChange={(e) => setForm({ ...form, bird_count: e.target.value })} />
                </div>
                <div>
                  <Label>Bags of Feed per Day *</Label>
                  <Input type="number" min={0} step="0.1" value={form.bags_per_day}
                    onChange={(e) => setForm({ ...form, bags_per_day: e.target.value })} />
                </div>

                <div>
                  <Label>Price per Bag (₦) *</Label>
                  <Input type="number" min={0} value={form.price_per_bag}
                    onChange={(e) => setForm({ ...form, price_per_bag: e.target.value })} />
                </div>
                <div>
                  <Label>Fallback Price per Crate (₦)</Label>
                  <Input type="number" min={0} value={form.fallback_price_per_crate}
                    onChange={(e) => setForm({ ...form, fallback_price_per_crate: e.target.value })}
                    placeholder="Used when no sale recorded" />
                </div>
                <div>
                  <Label>Fallback Price per Piece (₦)</Label>
                  <Input type="number" min={0} value={form.fallback_price_per_piece}
                    onChange={(e) => setForm({ ...form, fallback_price_per_piece: e.target.value })}
                    placeholder="Used when no sale recorded" />
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(form.start_date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.start_date}
                        onSelect={(d) => d && setForm({ ...form, start_date: d })}
                        initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(form.end_date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.end_date}
                        onSelect={(d) => d && setForm({ ...form, end_date: d })}
                        initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Baseline Eggs — Crates</Label>
                  <Input type="number" min={0} value={form.baseline_crates}
                    onChange={(e) => setForm({ ...form, baseline_crates: e.target.value })} />
                </div>
                <div>
                  <Label>Baseline Eggs — Pieces (0–29)</Label>
                  <Input type="number" min={0} max={29} value={form.baseline_pieces}
                    onChange={(e) => setForm({ ...form, baseline_pieces: e.target.value })} />
                </div>

                <div className="md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : monitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No profit monitors yet. {isAdmin && "Click \"New Profit Monitor\" to start tracking."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {monitors.map((m) => (
            <MonitorCard
              key={m.id}
              monitor={m}
              production={production}
              sales={sales}
              expenses={expenses}
              onDelete={isAdmin ? () => handleDelete(m.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MonitorCard({
  monitor,
  production,
  sales,
  expenses,
  onDelete,
}: {
  monitor: Monitor;
  production: any[];
  sales: any[];
  expenses: any[];
  onDelete?: () => void;
}) {
  const stats = useMemo(() => {
    const start = parseISO(monitor.start_date);
    const end = parseISO(monitor.end_date);
    const today = new Date();
    const periodEnd = today < end ? today : end;
    const daysElapsed = Math.max(1, differenceInCalendarDays(periodEnd, start) + 1);
    const totalDays = differenceInCalendarDays(end, start) + 1;

    const inRange = (d: string) => {
      const dt = parseISO(d);
      return dt >= start && dt <= periodEnd;
    };
    const inBranch = (b: string | null) =>
      !monitor.branch_id || b === monitor.branch_id;

    // Eggs produced
    const prod = production.filter((p) => inRange(p.date) && inBranch(p.branch_id));
    const totalProducedPieces =
      prod.reduce((s, p) => s + (p.crates || 0) * PIECES_PER_CRATE + (p.pieces || 0), 0) +
      monitor.baseline_crates * PIECES_PER_CRATE + monitor.baseline_pieces;

    // Egg sales (revenue + qty sold)
    const eggSales = sales.filter(
      (s) => inRange(s.date) && inBranch(s.branch_id) && /egg/i.test(s.product_type || "")
    );
    let revenueFromSales = 0;
    let soldPieces = 0;
    for (const s of eggSales) {
      revenueFromSales += Number(s.total_amount || 0);
      const q = Number(s.quantity || 0);
      const u = (s.unit || "").toLowerCase();
      if (u.includes("crate")) soldPieces += q * PIECES_PER_CRATE;
      else soldPieces += q;
    }

    // Unsold eggs valued at fallback
    const unsoldPieces = Math.max(totalProducedPieces - soldPieces, 0);
    const fallbackPerPiece =
      monitor.fallback_price_per_piece > 0
        ? monitor.fallback_price_per_piece
        : monitor.fallback_price_per_crate / PIECES_PER_CRATE;
    const revenueFromUnsold = unsoldPieces * fallbackPerPiece;
    const totalRevenue = revenueFromSales + revenueFromUnsold;

    // Costs: feed (bags/day * price * days) + miscellaneous expenses in period
    const feedCost = monitor.bags_per_day * monitor.price_per_bag * daysElapsed;
    const projectedFeedCost = monitor.bags_per_day * monitor.price_per_bag * totalDays;

    const periodExpenses = expenses
      .filter((e) => inRange(e.date) && inBranch(e.branch_id))
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const totalCost = feedCost + periodExpenses;
    const profit = totalRevenue - totalCost;
    const profitPerDay = profit / daysElapsed;

    return {
      daysElapsed,
      totalDays,
      totalProducedPieces,
      soldPieces,
      unsoldPieces,
      revenueFromSales,
      revenueFromUnsold,
      totalRevenue,
      feedCost,
      projectedFeedCost,
      periodExpenses,
      totalCost,
      profit,
      profitPerDay,
    };
  }, [monitor, production, sales, expenses]);

  const fmt = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const eggsDisplay = (pieces: number) =>
    `${Math.floor(pieces / PIECES_PER_CRATE)} crates ${pieces % PIECES_PER_CRATE} pcs`;

  const isProfit = stats.profit >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{monitor.name}</CardTitle>
            <CardDescription>
              {format(parseISO(monitor.start_date), "MMM d")} – {format(parseISO(monitor.end_date), "MMM d, yyyy")}
              {" · "}{monitor.bird_count} birds · {monitor.bags_per_day} bag/day
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isProfit ? "default" : "destructive"} className="text-sm">
              {isProfit ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {fmt(stats.profit)}
            </Badge>
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="font-semibold">{fmt(stats.totalRevenue)}</div>
            <div className="text-[10px] text-muted-foreground">
              Sales {fmt(stats.revenueFromSales)} · Unsold {fmt(stats.revenueFromUnsold)}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="font-semibold">{fmt(stats.totalCost)}</div>
            <div className="text-[10px] text-muted-foreground">
              Feed {fmt(stats.feedCost)} · Expenses {fmt(stats.periodExpenses)}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-xs text-muted-foreground">Eggs Produced</div>
            <div className="font-semibold">{eggsDisplay(stats.totalProducedPieces)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-xs text-muted-foreground">Eggs Sold</div>
            <div className="font-semibold">{eggsDisplay(stats.soldPieces)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-xs text-muted-foreground">Days Elapsed</div>
            <div className="font-semibold">{stats.daysElapsed} / {stats.totalDays}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-xs text-muted-foreground">Avg Profit/Day</div>
            <div className={cn("font-semibold", stats.profitPerDay >= 0 ? "text-green-600" : "text-destructive")}>
              {fmt(stats.profitPerDay)}
            </div>
          </div>
        </div>
        {monitor.notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 pl-2">{monitor.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
