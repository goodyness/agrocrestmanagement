import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Handshake } from "lucide-react";

interface Props {
  partnerLink: any;
  totalRevenue: number;
  totalCost: number;
}

/**
 * Read-only profit-share summary. Payouts happen via the partner's wallet
 * (Withdrawals) — no manual "add payout" here.
 */
const PartnerProfitShareWidget = ({ partnerLink, totalRevenue, totalCost }: Props) => {
  const [paidToDate, setPaidToDate] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);

  const totalProfit = totalRevenue - totalCost;
  const ownershipPct = Number(partnerLink?.share_percentage || 0);
  const profitPct = Number(partnerLink?.profit_share_percentage ?? partnerLink?.share_percentage ?? 0);
  const partnerShareAmount = totalProfit > 0 ? (totalProfit * profitPct) / 100 : 0;
  const outstanding = Math.max(0, partnerShareAmount - paidToDate - pendingTotal);

  useEffect(() => {
    const load = async () => {
      const profileId = partnerLink?.partners?.profile_id || partnerLink?.partners?.profiles?.id;
      if (!profileId) return;
      const { data } = await supabase
        .from("wallet_withdrawals")
        .select("amount, status")
        .eq("profile_id", profileId);
      const paid = (data || []).filter((r: any) => r.status === "approved" || r.status === "paid")
        .reduce((s, r: any) => s + Number(r.amount || 0), 0);
      const pend = (data || []).filter((r: any) => r.status === "pending")
        .reduce((s, r: any) => s + Number(r.amount || 0), 0);
      setPaidToDate(paid);
      setPendingTotal(pend);
    };
    load();
  }, [partnerLink?.id]);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" /> Profit Share Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-md border p-2">
            <p className="text-[11px] text-muted-foreground">Ownership</p>
            <p className="font-bold">{ownershipPct}%</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-[11px] text-muted-foreground">Profit Share</p>
            <p className="font-bold">{profitPct}%</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-[11px] text-muted-foreground">Total Profit</p>
            <p className={`font-bold ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
              ₦{totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-md border p-2 bg-primary/5">
            <p className="text-[11px] text-muted-foreground">Partner's Share</p>
            <p className="font-bold text-primary">
              ₦{partnerShareAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold">Paid via Wallet</p>
            <p className="font-bold">₦{paidToDate.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
            <p className="text-amber-700 dark:text-amber-400 font-semibold">Pending Withdrawals</p>
            <p className="font-bold">₦{pendingTotal.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-primary/10 border border-primary/30">
            <p className="text-primary font-semibold">Outstanding</p>
            <p className="font-bold">₦{outstanding.toLocaleString()}</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Partners request withdrawals from their dashboard wallet. Admins approve or reject them under the Withdrawals tab.
        </p>
      </CardContent>
    </Card>
  );
};

export default PartnerProfitShareWidget;
