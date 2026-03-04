import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Landmark, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

const FinanceTab = () => {
  const { currentBranchId } = useBranch();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [formData, setFormData] = useState({ bank_name: "", account_name: "", account_number: "", notes: "" });

  const fetchAccounts = async () => {
    setLoading(true);
    let query = supabase.from("bank_accounts").select("*").order("created_at", { ascending: false });
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data, error } = await query;
    if (error) toast.error("Failed to load bank accounts");
    setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, [currentBranchId]);

  const openAddDialog = () => {
    setEditingAccount(null);
    setFormData({ bank_name: "", account_name: "", account_number: "", notes: "" });
    setShowDialog(true);
  };

  const openEditDialog = (account: any) => {
    setEditingAccount(account);
    setFormData({
      bank_name: account.bank_name,
      account_name: account.account_name,
      account_number: account.account_number,
      notes: account.notes || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, branch_id: currentBranchId };

    if (editingAccount) {
      const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editingAccount.id);
      if (error) { toast.error("Failed to update account"); return; }
      toast.success("Account updated");
    } else {
      const { error } = await supabase.from("bank_accounts").insert(payload);
      if (error) { toast.error("Failed to add account"); return; }
      toast.success("Account added");
    }
    setShowDialog(false);
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bank account?")) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Account deleted");
    fetchAccounts();
  };

  const toggleActive = async (account: any) => {
    const { error } = await supabase.from("bank_accounts").update({ is_active: !account.is_active }).eq("id", account.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(account.is_active ? "Account deactivated" : "Account activated");
    fetchAccounts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Farm Bank Accounts</h2>
          <p className="text-sm text-muted-foreground">Manage bank accounts for customer payments</p>
        </div>
        <Button size="sm" onClick={openAddDialog}><Plus className="h-4 w-4 mr-1" /> Add Account</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-1">No bank accounts added yet</p>
            <p className="text-sm">Add farm bank accounts so workers and customers can see payment details</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className={`relative ${!account.is_active ? "opacity-60" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {account.bank_name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(account)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(account.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{account.account_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Account Number</p>
                  <p className="text-xl font-mono font-bold tracking-wider">{account.account_number}</p>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={account.is_active ? "default" : "secondary"} className="text-xs cursor-pointer" onClick={() => toggleActive(account)}>
                    {account.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {account.notes && <p className="text-xs text-muted-foreground truncate max-w-[150px]">{account.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} placeholder="e.g. First Bank, GTBank, Access Bank" required />
            </div>
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input value={formData.account_name} onChange={(e) => setFormData({ ...formData, account_name: e.target.value })} placeholder="Account holder name" required />
            </div>
            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input value={formData.account_number} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} placeholder="10-digit account number" required />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="e.g. For egg sales only" />
            </div>
            <Button type="submit" className="w-full">{editingAccount ? "Update Account" : "Add Account"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceTab;
