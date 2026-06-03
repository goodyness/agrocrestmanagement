import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import { format, parseISO } from "date-fns";
import { uploadEvidencePhoto } from "@/lib/photoUpload";

type Check = {
  id: string; check_date: string; check_type: string; area: string | null;
  performed_by_name: string | null; status: string; notes: string | null;
  photo_url: string | null; branch_id: string | null;
};

const CHECK_TYPES = ["Visitor Log", "Footbath", "Disinfection", "Vehicle Wash", "Equipment Cleaning", "Other"];

const BiosecuritySection = () => {
  const { currentBranchId } = useBranch();
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [form, setForm] = useState({
    check_date: format(new Date(), "yyyy-MM-dd"),
    check_type: "Footbath",
    area: "",
    performed_by_name: "",
    status: "passed",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("biosecurity_checks").select("*").order("check_date", { ascending: false });
    if (currentBranchId) q = q.eq("branch_id", currentBranchId);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setChecks((data || []) as Check[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [currentBranchId]);

  const pag = usePagination({ totalItems: checks.length, itemsPerPage: 15 });
  const paginatedChecks = checks.slice(pag.paginatedRange.startIndex, pag.paginatedRange.endIndex);

  const handleSave = async () => {
    const { data: u } = await supabase.auth.getUser();
    let photo_url: string | null = null;
    if (photo) {
      photo_url = await uploadEvidencePhoto(photo, "biosecurity");
      if (!photo_url) return toast.error("Photo upload failed");
    }
    const { error } = await supabase.from("biosecurity_checks").insert({
      check_date: form.check_date, check_type: form.check_type, area: form.area || null,
      performed_by: u.user?.id, performed_by_name: form.performed_by_name || u.user?.email || null,
      status: form.status, notes: form.notes || null, photo_url, branch_id: currentBranchId,
    });
    if (error) return toast.error(error.message);
    toast.success("Biosecurity check recorded");
    setOpen(false); setPhoto(null);
    setForm({ check_date: format(new Date(), "yyyy-MM-dd"), check_type: "Footbath", area: "", performed_by_name: "", status: "passed", notes: "" });
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Biosecurity Checks</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Record Check</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Biosecurity Check</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.check_date} onChange={e => setForm({ ...form, check_date: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.check_type} onValueChange={v => setForm({ ...form, check_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CHECK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Area / Location</Label><Input value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="needs_attention">Needs Attention</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Performed By</Label><Input value={form.performed_by_name} onChange={e => setForm({ ...form, performed_by_name: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div><Label>Evidence Photo</Label><Input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} /></div>
            </div>
            <DialogFooter><Button onClick={handleSave}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : checks.length === 0 ? <p className="text-muted-foreground text-sm">No checks recorded yet.</p> : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Area</TableHead><TableHead>By</TableHead><TableHead>Status</TableHead><TableHead>Photo</TableHead></TableRow></TableHeader>
              <TableBody>
                {paginatedChecks.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{format(parseISO(c.check_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{c.check_type}</TableCell>
                    <TableCell>{c.area || "—"}</TableCell>
                    <TableCell>{c.performed_by_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "passed" ? "secondary" : "destructive"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>{c.photo_url ? <a href={c.photo_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View</a> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls currentPage={pag.currentPage} totalPages={pag.totalPages} onPageChange={pag.goToPage} getPageNumbers={pag.getPageNumbers} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BiosecuritySection;
