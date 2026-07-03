import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Handshake } from "lucide-react";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().min(4).max(500),
  bank_name: z.string().trim().min(2).max(80),
  account_number: z.string().trim().regex(/^\d{6,15}$/, "6-15 digit account number"),
  account_name: z.string().trim().min(2).max(120),
});

interface Props {
  open: boolean;
  profileId: string;
  onDone: () => void;
}

export default function PartnerOnboardingDialog({ open, profileId, onDone }: Props) {
  const [form, setForm] = useState({
    full_name: "", phone: "", address: "", bank_name: "", account_number: "", account_name: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please check your details");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("partner_bank_details")
      .insert([{ ...parsed.data, profile_id: profileId }] as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome! Your details are saved.");
    onDone();
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Handshake className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Complete Your Partner Profile</DialogTitle>
              <DialogDescription className="text-xs">Required before you access your portal. These details are used for wallet withdrawals.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={set("full_name")} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set("phone")} maxLength={30} />
            </div>
            <div className="space-y-1">
              <Label>Bank Name</Label>
              <Input value={form.bank_name} onChange={set("bank_name")} maxLength={80} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Account Number</Label>
              <Input value={form.account_number} onChange={set("account_number")} inputMode="numeric" maxLength={15} />
            </div>
            <div className="space-y-1">
              <Label>Account Name</Label>
              <Input value={form.account_name} onChange={set("account_name")} maxLength={120} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={set("address")} maxLength={500} rows={2} />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save & Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
