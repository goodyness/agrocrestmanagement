import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Clock, TrendingUp, ArrowUpRight } from "lucide-react";
import WithdrawalRequestDialog from "./WithdrawalRequestDialog";

interface Props {
  profileId: string;
}

export default function WalletCard({ profileId }: Props) {
  const [w, setW] = useState({ total_earned: 0, total_withdrawn: 0, pending_withdrawals: 0, available_balance: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.rpc("get_partner_wallet", { _profile_id: profileId } as any);
    if (data && (data as any).length) setW((data as any)[0]);
    const { data: hist } = await supabase
      .from("wallet_withdrawals")
      .select("*")
      .eq("profile_id", profileId)
      .order("requested_at", { ascending: false })
      .limit(5);
    setHistory(hist || []);
  };

  useEffect(() => { if (profileId) load(); }, [profileId]);

  const canWithdraw = Number(w.available_balance) >= 5000;

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <p className="font-semibold">Wallet</p>
            </div>
            <Button size="sm" disabled={!canWithdraw} onClick={() => setOpen(true)}>
              <ArrowUpRight className="h-4 w-4 mr-1" /> Withdraw
            </Button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-3xl font-bold">₦{Number(w.available_balance || 0).toLocaleString()}</p>
            {!canWithdraw && Number(w.available_balance) > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">Minimum ₦5,000 required to request a withdrawal.</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
            <div>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" /> Earned</p>
              <p className="text-sm font-semibold">₦{Number(w.total_earned || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> Pending</p>
              <p className="text-sm font-semibold">₦{Number(w.pending_withdrawals || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Paid Out</p>
              <p className="text-sm font-semibold">₦{Number(w.total_withdrawn || 0).toLocaleString()}</p>
            </div>
          </div>
          {history.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">Recent requests</p>
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span>₦{Number(h.amount).toLocaleString()}</span>
                  <Badge variant={h.status === "paid" || h.status === "approved" ? "default" : h.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">{h.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <WithdrawalRequestDialog open={open} onOpenChange={setOpen} profileId={profileId} available={Number(w.available_balance)} onDone={load} />
    </>
  );
}
