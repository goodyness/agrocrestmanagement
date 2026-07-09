import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Skull, DollarSign, ListFilter, PackageCheck } from "lucide-react";

interface Props {
  careLogs: any[];
  mortalityRecords: any[];
  expenses: any[];
  availabilityEvents?: any[];
}

type Filter = "all" | "care" | "mortality" | "expense" | "availability";

const ICONS: Record<string, any> = { care: Heart, mortality: Skull, expense: DollarSign, availability: PackageCheck };
const COLORS: Record<string, string> = {
  care: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  mortality: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  expense: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  availability: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const ActivityTimeline = ({ careLogs, mortalityRecords, expenses, availabilityEvents = [] }: Props) => {
  const [filter, setFilter] = useState<Filter>("all");

  const events = useMemo(() => {
    const arr: any[] = [];
    careLogs.forEach((c: any) => arr.push({
      type: "care", id: `c-${c.id}`,
      date: c.care_date || c.created_at,
      title: `${c.care_type ? c.care_type.replace(/_/g, " ") : "Care"}: ${c.description || c.product_name || ""}`.trim(),
      meta: c.dosage ? `Dosage: ${c.dosage}` : (c.product_name || ""),
      user: c.profiles?.name,
    }));
    mortalityRecords.forEach((m: any) => arr.push({
      type: "mortality", id: `m-${m.id}`,
      date: m.date || m.created_at,
      title: `${m.quantity_dead} death(s) — ${m.reason || "reason unspecified"}`,
      meta: null, user: m.profiles?.name,
    }));
    expenses.forEach((e: any) => arr.push({
      type: "expense", id: `e-${e.id}`,
      date: e.date || e.created_at,
      title: `${e.expense_type}: ₦${Number(e.amount).toLocaleString()}`,
      meta: e.description, user: e.profiles?.name,
    }));
    availabilityEvents.forEach((a: any) => {
      const t = a.event_type as string;
      const title =
        t === "marked_available" ? "Stock marked available — age counting started"
        : t === "overdue_notified" ? "Overdue notification sent"
        : t === "expected_updated" ? "Expected stock details updated"
        : `Availability: ${t.replace(/_/g, " ")}`;
      arr.push({
        type: "availability", id: `a-${a.id}`,
        date: a.created_at,
        title,
        meta: a.notes || null,
        user: a.profiles?.name || (a.changed_by_role ? a.changed_by_role : null),
      });
    });
    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [careLogs, mortalityRecords, expenses, availabilityEvents]);

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ListFilter className="h-4 w-4 text-muted-foreground" />
        {(["all", "care", "mortality", "expense", "availability"] as Filter[]).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)} className="capitalize h-7 px-3 text-xs">
            {f}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} events</span>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No activity to display.</CardContent></Card>
      ) : (
        <div className="relative border-l-2 border-primary/20 ml-3 space-y-3 pl-4">
          {filtered.map(ev => {
            const Icon = ICONS[ev.type];
            return (
              <div key={ev.id} className="relative">
                <span className={`absolute -left-[26px] top-1 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center ${COLORS[ev.type]}`}>
                  <Icon className="h-3 w-3" />
                </span>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{ev.title}</p>
                        {ev.meta && <p className="text-xs text-muted-foreground mt-0.5">{ev.meta}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(ev.date).toLocaleString()} • by <span className="font-medium">{ev.user || "Unknown"}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${COLORS[ev.type]}`}>{ev.type}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;
