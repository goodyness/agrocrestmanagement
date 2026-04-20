import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Props {
  logs: any[];
}

const TreatmentCoursesWidget = ({ logs }: Props) => {
  const activeCourses = useMemo(() => {
    const courses: Record<string, any[]> = {};
    logs.forEach((l) => {
      if (l.course_id) {
        if (!courses[l.course_id]) courses[l.course_id] = [];
        courses[l.course_id].push(l);
      }
    });
    const today = new Date();
    return Object.values(courses)
      .map((entries) => {
        const sorted = [...entries].sort((a, b) => a.care_date.localeCompare(b.care_date));
        const f = sorted[0];
        return { entries: sorted, first: f };
      })
      .filter((c) => new Date(c.first.course_end_date) >= today);
  }, [logs]);

  if (activeCourses.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Active Treatment Courses ({activeCourses.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeCourses.map((c) => {
          const f = c.first;
          const total = f.course_total_days;
          const completed = c.entries.length;
          const todayDay = Math.min(total, differenceInDays(new Date(), new Date(f.course_start_date)) + 1);
          const progress = Math.round((todayDay / total) * 100);
          return (
            <div key={f.course_id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {f.product_name || f.description.slice(0, 30)}{" "}
                  <span className="text-muted-foreground text-xs">({f.care_type})</span>
                </span>
                <Badge variant="outline" className="text-xs">
                  Day {todayDay}/{total}
                </Badge>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Logged {completed}/{total} doses • Ends {format(new Date(f.course_end_date), "MMM dd")}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default TreatmentCoursesWidget;
