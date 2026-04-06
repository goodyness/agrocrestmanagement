import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stethoscope, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { format, differenceInDays } from "date-fns";

const VetVisitLog = () => {
  const { currentBranchId } = useBranch();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    batch_id: "",
    visit_date: format(new Date(), "yyyy-MM-dd"),
    vet_name: "",
    diagnosis: "",
    treatment: "",
    prescription: "",
    follow_up_date: "",
    cost: "",
    notes: "",
  });

  const { data: visits } = useQuery({
    queryKey: ["vet-visits", currentBranchId],
    queryFn: async () => {
      let q = supabase
        .from("vet_visit_logs")
        .select("*, livestock_batches(species, species_type)")
        .order("visit_date", { ascending: false });
      if (currentBranchId) q = q.eq("branch_id", currentBranchId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: batches } = useQuery({
    queryKey: ["active-batches-vet", currentBranchId],
    queryFn: async () => {
      let q = supabase
        .from("livestock_batches")
        .select("id, species, species_type, current_quantity")
        .eq("is_active", true);
      if (currentBranchId) q = q.eq("branch_id", currentBranchId);
      const { data } = await q;
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!form.vet_name || !form.diagnosis) {
      toast.error("Vet name and diagnosis are required");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("vet_visit_logs").insert({
      batch_id: form.batch_id || null,
      branch_id: currentBranchId,
      visit_date: form.visit_date,
      vet_name: form.vet_name,
      diagnosis: form.diagnosis,
      treatment: form.treatment || null,
      prescription: form.prescription || null,
      follow_up_date: form.follow_up_date || null,
      cost: Number(form.cost) || 0,
      notes: form.notes || null,
      recorded_by: user.id,
    });

    if (error) {
      toast.error("Failed to log vet visit");
      return;
    }

    toast.success("Vet visit logged");
    setOpen(false);
    setForm({ batch_id: "", visit_date: format(new Date(), "yyyy-MM-dd"), vet_name: "", diagnosis: "", treatment: "", prescription: "", follow_up_date: "", cost: "", notes: "" });
    queryClient.invalidateQueries({ queryKey: ["vet-visits"] });
  };

  const upcomingFollowUps = visits?.filter((v: any) => v.follow_up_date && differenceInDays(new Date(v.follow_up_date), new Date()) >= 0 && differenceInDays(new Date(v.follow_up_date), new Date()) <= 7) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Veterinary Visit Log
            </CardTitle>
            <CardDescription>Track vet visits, diagnoses, and prescriptions per batch</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log Visit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Log Veterinary Visit</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Batch (Optional)</Label>
                  <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                    <SelectContent>
                      {batches?.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.species} {b.species_type ? `(${b.species_type})` : ""} - {b.current_quantity} birds
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Visit Date *</Label>
                  <Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
                </div>
                <div>
                  <Label>Veterinarian Name *</Label>
                  <Input value={form.vet_name} onChange={(e) => setForm({ ...form, vet_name: e.target.value })} />
                </div>
                <div>
                  <Label>Diagnosis *</Label>
                  <Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
                </div>
                <div>
                  <Label>Treatment</Label>
                  <Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
                </div>
                <div>
                  <Label>Prescription</Label>
                  <Textarea value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} />
                </div>
                <div>
                  <Label>Follow-up Date</Label>
                  <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
                </div>
                <div>
                  <Label>Cost (₦)</Label>
                  <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={handleSubmit} className="w-full">Save Vet Visit</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingFollowUps.length > 0 && (
          <div className="p-3 border-2 border-warning/30 rounded-lg bg-warning/5">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-warning" />
              Upcoming Follow-ups ({upcomingFollowUps.length})
            </p>
            {upcomingFollowUps.map((v: any) => (
              <p key={v.id} className="text-xs text-muted-foreground mt-1">
                {format(new Date(v.follow_up_date), "MMM dd")} - {v.vet_name}: {v.diagnosis}
              </p>
            ))}
          </div>
        )}

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vet</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!visits || visits.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No vet visits recorded</TableCell>
                </TableRow>
              ) : (
                visits.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm">{format(new Date(v.visit_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-sm font-medium">{v.vet_name}</TableCell>
                    <TableCell className="text-sm">
                      {v.livestock_batches ? `${v.livestock_batches.species}${v.livestock_batches.species_type ? ` (${v.livestock_batches.species_type})` : ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-sm max-w-40 truncate">{v.diagnosis}</TableCell>
                    <TableCell className="text-sm">₦{Number(v.cost).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">
                      {v.follow_up_date ? (
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(v.follow_up_date), "MMM dd")}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default VetVisitLog;
