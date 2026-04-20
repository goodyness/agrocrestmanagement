import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const CARE_TYPE_COLORS: Record<string, string> = {
  vaccination: "bg-blue-500",
  medication: "bg-red-500",
  antibiotics: "bg-rose-600",
  feeding: "bg-green-500",
  supplement: "bg-yellow-500",
  deworming: "bg-purple-500",
  vitamin: "bg-orange-500",
  observation: "bg-muted-foreground",
  other: "bg-muted-foreground",
};

interface Props {
  logs: any[];
}

const CareLogsView = ({ logs }: Props) => {
  const [view, setView] = useState<"day" | "course" | "flat">("day");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (k: string) => setOpenGroups((s) => ({ ...s, [k]: !s[k] }));

  // Group by day
  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    logs.forEach((l) => {
      const k = l.care_date;
      if (!map[k]) map[k] = [];
      map[k].push(l);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  // Group by course (course_id), with stand-alone single-day entries grouped under "individual"
  const byCourse = useMemo(() => {
    const courses: Record<string, any[]> = {};
    const standalones: any[] = [];
    logs.forEach((l) => {
      if (l.course_id) {
        if (!courses[l.course_id]) courses[l.course_id] = [];
        courses[l.course_id].push(l);
      } else {
        standalones.push(l);
      }
    });
    const courseList = Object.entries(courses).map(([id, entries]) => {
      const sorted = [...entries].sort((a, b) => a.care_date.localeCompare(b.care_date));
      return { id, entries: sorted, first: sorted[0] };
    });
    courseList.sort((a, b) => b.first.care_date.localeCompare(a.first.care_date));
    return { courseList, standalones };
  }, [logs]);

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No care records yet. Start logging daily care!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="day">📅 By Day</TabsTrigger>
          <TabsTrigger value="course">💊 By Course</TabsTrigger>
          <TabsTrigger value="flat">📋 List</TabsTrigger>
        </TabsList>

        {/* By Day */}
        <TabsContent value="day" className="space-y-2 mt-3">
          {byDay.map(([date, entries]) => (
            <Collapsible
              key={date}
              open={openGroups[date] !== false}
              onOpenChange={() => toggleGroup(date)}
            >
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${openGroups[date] === false ? "-rotate-90" : ""}`}
                      />
                      <span className="font-semibold text-sm">{format(new Date(date), "MMM dd, yyyy")}</span>
                      <Badge variant="secondary" className="text-xs">{entries.length} record{entries.length > 1 ? "s" : ""}</Badge>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2">
                    {entries.map((log) => (
                      <LogEntry key={log.id} log={log} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </TabsContent>

        {/* By Course */}
        <TabsContent value="course" className="space-y-2 mt-3">
          {byCourse.courseList.map((c) => {
            const f = c.first;
            const last = c.entries[c.entries.length - 1];
            const today = new Date();
            const endD = new Date(f.course_end_date);
            const isActive = endD >= today;
            const completed = c.entries.length;
            const total = f.course_total_days || c.entries.length;
            const progress = Math.round((completed / total) * 100);

            return (
              <Collapsible
                key={c.id}
                open={openGroups[c.id] !== false}
                onOpenChange={() => toggleGroup(c.id)}
              >
                <Card className={isActive ? "border-primary/40" : ""}>
                  <CollapsibleTrigger className="w-full text-left">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 transition-transform ${openGroups[c.id] === false ? "-rotate-90" : ""}`}
                          />
                          <Badge className={`${CARE_TYPE_COLORS[f.care_type]} text-white text-xs shrink-0`}>
                            {f.care_type}
                          </Badge>
                          <span className="font-semibold text-sm truncate">
                            {f.product_name || f.description.slice(0, 40)}
                          </span>
                        </div>
                        {isActive && <Badge className="bg-primary text-xs">Active</Badge>}
                      </div>
                      <div className="mt-2 ml-6 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          📆 {format(new Date(f.course_start_date), "MMM dd")} → {format(endD, "MMM dd")}
                          {" • "}Day {completed} of {total}
                        </p>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      {c.entries.map((log) => (
                        <LogEntry key={log.id} log={log} compact />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

          {byCourse.standalones.length > 0 && (
            <Collapsible
              open={openGroups["__standalone"] !== false}
              onOpenChange={() => toggleGroup("__standalone")}
            >
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openGroups["__standalone"] === false ? "-rotate-90" : ""}`} />
                      <span className="font-semibold text-sm">Individual Care Records</span>
                      <Badge variant="secondary" className="text-xs">{byCourse.standalones.length}</Badge>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2">
                    {byCourse.standalones.map((log) => (
                      <LogEntry key={log.id} log={log} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </TabsContent>

        {/* Flat list */}
        <TabsContent value="flat" className="space-y-2 mt-3">
          {logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const LogEntry = ({ log, compact = false }: { log: any; compact?: boolean }) => {
  const inWithdrawal = log.withdrawal_end_date && new Date(log.withdrawal_end_date) >= new Date();
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {!compact && (
            <Badge className={`${CARE_TYPE_COLORS[log.care_type]} text-white text-xs`}>{log.care_type}</Badge>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{log.description}</p>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
              <span>📅 {format(new Date(log.care_date), "MMM dd")}</span>
              {log.course_day_number && (
                <span className="text-primary">Day {log.course_day_number}/{log.course_total_days}</span>
              )}
              {log.product_name && <span>💊 {log.product_name}</span>}
              {log.dosage && <span>📏 {log.dosage}</span>}
              {log.quantity_affected && <span>🐾 {log.quantity_affected}</span>}
              {log.cost > 0 && <span>💰 ₦{Number(log.cost).toLocaleString()}</span>}
              {log.profiles?.name && <span>👤 {log.profiles.name}</span>}
            </div>
            {inWithdrawal && (
              <Badge variant="outline" className="mt-1 bg-warning/10 text-warning border-warning/30 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Withdrawal until {format(new Date(log.withdrawal_end_date), "MMM dd")}
              </Badge>
            )}
            {log.notes && <p className="text-xs mt-1 italic">{log.notes}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CareLogsView;
