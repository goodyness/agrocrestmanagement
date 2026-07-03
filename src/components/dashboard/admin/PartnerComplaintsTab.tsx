import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function PartnerComplaintsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [resp, setResp] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("batch_complaints")
      .select("*, partners(profiles!partners_profile_id_fkey(name, email)), livestock_batches(species, species_type)")
      .order("created_at", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const resolve = async () => {
    if (!sel) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_complaints").update({
      status: "resolved", admin_response: resp.slice(0, 1000) || null,
      resolved_at: new Date().toISOString(), resolved_by: user?.id || null,
    }).eq("id", sel.id);
    if (error) return toast.error(error.message);
    toast.success("Complaint resolved");
    setSel(null); setResp(""); load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Partner Complaints</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-xs text-muted-foreground py-6 text-center">No complaints</p> : rows.map((r) => (
          <div key={r.id} className="border rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{r.partners?.profiles?.name || r.partners?.profiles?.email}</p>
              <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground capitalize">Batch: {r.livestock_batches?.species_type || r.livestock_batches?.species}</p>
            <p className="text-sm">{r.message}</p>
            {r.admin_response && <p className="text-xs text-primary">Response: {r.admin_response}</p>}
            {r.status === "open" && <Button size="sm" onClick={() => setSel(r)}>Respond & Resolve</Button>}
          </div>
        ))}
      </CardContent>

      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); setResp(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Respond to Complaint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm bg-muted/40 p-2 rounded">{sel?.message}</p>
            <Textarea rows={4} value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Your response..." maxLength={1000} />
            <Button className="w-full" onClick={resolve}>Mark Resolved</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
