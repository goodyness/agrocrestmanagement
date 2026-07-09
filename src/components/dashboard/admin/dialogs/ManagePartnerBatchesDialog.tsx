import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: any | null;
  onChanged?: () => void;
}

const ManagePartnerBatchesDialog = ({ open, onOpenChange, partner, onChanged }: Props) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [batchId, setBatchId] = useState("");
  const [share, setShare] = useState("50");

  const load = async () => {
    if (!partner) return;
    const [{ data: bs }, { data: ls }] = await Promise.all([
      supabase.from("livestock_batches").select("id, species, species_type, stage, current_quantity, date_acquired").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("partner_batches").select("*, livestock_batches(species, species_type, stage, current_quantity)").eq("partner_id", partner.id),
    ]);
    setBatches(bs || []);
    setLinks(ls || []);
  };

  useEffect(() => { if (open) load(); }, [open, partner?.id]);

  const addLink = async () => {
    if (!batchId) return toast.error("Select a batch");
    const pct = parseFloat(share) || 0;
    const { error } = await supabase.from("partner_batches").insert({
      partner_id: partner.id,
      batch_id: batchId,
      share_percentage: pct,
      profit_share_percentage: pct,
    });
    if (error) return toast.error(error.message);
    toast.success("Batch linked to partner");
    setBatchId(""); setShare("50");
    load();
    onChanged?.();
  };

  const removeLink = async (id: string) => {
    if (!confirm("Remove this batch from partner?")) return;
    const { error } = await supabase.from("partner_batches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Link removed");
    load();
    onChanged?.();
  };

  const unlinkedBatches = batches.filter(b => !links.some(l => l.batch_id === b.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Batches — {partner?.profiles?.name || "Partner"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
            <p className="text-sm font-semibold">Link a new batch</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="md:col-span-2">
                <Label className="text-xs">Batch</Label>
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {unlinkedBatches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.species_type || b.species} • {b.current_quantity} • {b.stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ownership / Profit Share %</Label>
                <Input type="number" min={0} max={100} value={share} onChange={e => setShare(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The percentage represents both ownership and profit share. Budget & contributions are set on the batch itself.</p>
            <Button size="sm" onClick={addLink} disabled={!batchId}>
              <Plus className="h-4 w-4 mr-1" /> Link Batch
            </Button>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Linked Batches ({links.length})</p>
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">No batches linked yet</p>
            ) : (
              <div className="space-y-2">
                {links.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {l.livestock_batches?.species_type || l.livestock_batches?.species} • {l.livestock_batches?.current_quantity} animals
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{l.share_percentage}% ownership</Badge>
                        <Badge variant="outline" className="text-xs">{l.profit_share_percentage ?? l.share_percentage}% profit</Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeLink(l.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagePartnerBatchesDialog;
