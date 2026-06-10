import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AddPartnerDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState<string>("none");
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data || []));
  }, [open]);

  const reset = () => { setName(""); setEmail(""); setPhone(""); setNotes(""); setBranchId("none"); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-partner", {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          branch_id: branchId === "none" ? null : branchId,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error(error?.message || (data as any)?.error || "Failed to create partner");
      }
      toast.success("Partner created — login details emailed");
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to create partner");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Partner</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner full name" required />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" required />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional phone" />
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="Attach to a branch (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No branch —</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Attach the partner to a branch so their batches are scoped correctly.</p>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this partner" />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 border rounded-md p-3">
            A temporary password will be generated and emailed to the partner using your farm's SMTP. They can change it via "Forgot password" on sign-in.
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Creating..." : "Create Partner & Send Invite"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPartnerDialog;
