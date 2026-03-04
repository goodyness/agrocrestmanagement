import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Landmark, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FarmAccountsSection = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("bank_name");
      setAccounts(data || []);
    };
    fetchAccounts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("bank_accounts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, () => {
        fetchAccounts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const copyToClipboard = (account: any) => {
    navigator.clipboard.writeText(account.account_number);
    setCopiedId(account.id);
    toast.success(`Copied ${account.bank_name} account number`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (accounts.length === 0) return null;

  return (
    <Card className="shadow-md border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Farm Bank Accounts
        </CardTitle>
        <CardDescription>Payment account details for customers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((account) => (
            <div key={account.id} className="bg-muted/30 rounded-lg p-3 border space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  {account.bank_name}
                </p>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(account)}>
                  {copiedId === account.id ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{account.account_name}</p>
              <p className="font-mono font-bold text-base tracking-wider">{account.account_number}</p>
              {account.notes && <p className="text-xs text-muted-foreground italic">{account.notes}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FarmAccountsSection;
