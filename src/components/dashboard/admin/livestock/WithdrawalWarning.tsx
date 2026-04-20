import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Props {
  logs: any[];
}

const WithdrawalWarning = ({ logs }: Props) => {
  const active = useMemo(() => {
    const today = new Date();
    return logs
      .filter((l) => l.withdrawal_end_date && new Date(l.withdrawal_end_date) >= today)
      .sort((a, b) => b.withdrawal_end_date.localeCompare(a.withdrawal_end_date));
  }, [logs]);

  if (active.length === 0) return null;

  // Latest withdrawal date determines safety
  const latest = active[0];
  const daysLeft = differenceInDays(new Date(latest.withdrawal_end_date), new Date()) + 1;

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning">
              ⚠️ Drug Withdrawal Active — Do NOT sell products from this batch
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {active.length} active withdrawal period{active.length > 1 ? "s" : ""}.
              Safe to sell from <strong>{format(new Date(latest.withdrawal_end_date), "MMM dd, yyyy")}</strong>
              {" "}({daysLeft} day{daysLeft > 1 ? "s" : ""} remaining)
            </p>
            <div className="mt-2 space-y-0.5">
              {active.slice(0, 3).map((l) => (
                <p key={l.id} className="text-xs">
                  • {l.product_name || l.care_type} — ends {format(new Date(l.withdrawal_end_date), "MMM dd")}
                </p>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WithdrawalWarning;
