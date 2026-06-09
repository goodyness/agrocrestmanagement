import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Handshake, Link2 } from "lucide-react";
import { toast } from "sonner";
import AddPartnerDialog from "./dialogs/AddPartnerDialog";
import ManagePartnerBatchesDialog from "./dialogs/ManagePartnerBatchesDialog";

const PartnersTab = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partners")
      .select("*, profiles!partners_profile_id_fkey(name, email), partner_batches(id, batch_id, share_percentage, investment_amount)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setPartners(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (p: any) => {
    if (!confirm(`Remove partner ${p.profiles?.name}? This deletes their account and links.`)) return;
    // Delete profile cascades to partners & partner_batches; auth user requires admin API — leave orphaned auth user
    const { error } = await supabase.from("profiles").delete().eq("id", p.profile_id);
    if (error) return toast.error(error.message);
    toast.success("Partner removed");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Partners</h2>
          <Badge variant="secondary">{partners.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Partner
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : partners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Handshake className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No partners yet</p>
            <p className="text-sm">Register your first investment partner — they'll get login details by email.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {partners.map((p: any) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{p.profiles?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.profiles?.email}</p>
                    {p.phone && <p className="text-xs text-muted-foreground">📞 {p.phone}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {p.partner_batches?.length || 0} batch{(p.partner_batches?.length || 0) === 1 ? "" : "es"}
                      </Badge>
                      {(p.partner_batches?.length || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          ₦{(p.partner_batches?.reduce((s: number, b: any) => s + Number(b.investment_amount || 0), 0)).toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    {p.notes && <p className="text-xs text-muted-foreground mt-2 italic">"{p.notes}"</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => setManaging(p)}>
                      <Link2 className="h-3.5 w-3.5 mr-1" /> Batches
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddPartnerDialog open={showAdd} onOpenChange={setShowAdd} onSuccess={load} />
      <ManagePartnerBatchesDialog open={!!managing} onOpenChange={(o) => !o && setManaging(null)} partner={managing} onChanged={load} />
    </div>
  );
};

export default PartnersTab;
