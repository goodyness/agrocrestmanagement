import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  branchId: string | null;
  batch?: any;
}

const SPECIES_CONFIG: Record<string, { types: string[]; stages: Record<string, string[]> }> = {
  // ... existing config (unchanged)
  chicken: {
    types: ["layer", "broiler", "noiler", "cockerel", "other"],
    stages: {
      layer: ["pullet", "point_of_cage", "point_of_lay", "laying"],
      broiler: ["pullet", "grower", "finisher"],
      noiler: ["pullet", "grower", "adult"],
      cockerel: ["chick", "grower", "adult"],
      other: ["chick", "grower", "adult"],
    },
  },
  pig: {
    types: [],
    stages: { "": ["piglet", "weaner", "grower", "finisher", "sow", "boar"] },
  },
  goat: {
    types: ["west_african_dwarf", "red_sokoto", "sahel", "boer", "other"],
    stages: { "": ["kid", "yearling", "adult", "doe", "buck"] },
  },
  cattle: {
    types: ["white_fulani", "ndama", "muturu", "sokoto_gudali", "other"],
    stages: { "": ["calf", "yearling", "adult", "cow", "bull"] },
  },
  other: {
    types: [],
    stages: { "": ["young", "adult"] },
  },
};

const STAGE_LABELS: Record<string, string> = {
  pullet: "Day-Old / Pullet",
  point_of_cage: "Point of Cage (~16 weeks)",
  point_of_lay: "Point of Lay (~20 weeks)",
  laying: "Currently Laying",
  piglet: "Piglet (0-4 weeks)",
  weaner: "Weaner (4-8 weeks)",
  grower: "Grower",
  finisher: "Finisher",
  sow: "Sow (Female breeder)",
  boar: "Boar (Male breeder)",
  kid: "Kid",
  yearling: "Yearling",
  adult: "Adult",
  doe: "Doe (Female)",
  buck: "Buck (Male)",
  calf: "Calf",
  cow: "Cow",
  bull: "Bull",
  chick: "Chick",
  young: "Young",
};

const RegisterBatchDialog = ({ open, onOpenChange, onSuccess, branchId, batch }: Props) => {
  const [loading, setLoading] = useState(false);
  const [species, setSpecies] = useState(batch?.species || "");
  const [speciesType, setSpeciesType] = useState(batch?.species_type || "");
  const [stage, setStage] = useState(batch?.stage || "");
  const [ageWeeks, setAgeWeeks] = useState(batch?.age_weeks || 0);
  const [quantity, setQuantity] = useState(batch?.quantity || 0);
  const [currentQuantity, setCurrentQuantity] = useState(batch?.current_quantity || 0);
  const [source, setSource] = useState(batch?.source || "");
  const [costPerUnit, setCostPerUnit] = useState(batch?.cost_per_unit || 0);
  const [notes, setNotes] = useState(batch?.notes || "");
  const [budget, setBudget] = useState<string>(batch?.budget?.toString() || "0");
  const [adminContribution, setAdminContribution] = useState<string>(batch?.admin_contribution?.toString() || "0");
  const [availabilityStatus, setAvailabilityStatus] = useState<"available" | "pending">(
    (batch?.availability_status as any) || "available"
  );
  const [expectedSource, setExpectedSource] = useState(batch?.expected_source || "");
  const [expectedCost, setExpectedCost] = useState<string>(batch?.expected_cost_per_unit?.toString() || "");
  const [expectedArrival, setExpectedArrival] = useState<string>(batch?.expected_arrival_date || "");
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [partnerShare, setPartnerShare] = useState("50");
  const [partnerProfitShare, setPartnerProfitShare] = useState("50");
  const [partnerInvestment, setPartnerInvestment] = useState("0");
  const [partners, setPartners] = useState<any[]>([]);
  const [existingPartnerLink, setExistingPartnerLink] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("partners")
      .select("id, profiles!partners_profile_id_fkey(name, email)")
      .then(({ data }) => setPartners(data || []));

    if (batch?.id) {
      supabase
        .from("partner_batches")
        .select("*, partners(id, profiles!partners_profile_id_fkey(name, email))")
        .eq("batch_id", batch.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setExistingPartnerLink(data);
            setHasPartner(true);
            setPartnerId(data.partner_id);
            setPartnerShare(String(data.share_percentage ?? "50"));
            setPartnerProfitShare(String(data.profit_share_percentage ?? data.share_percentage ?? "50"));
            setPartnerInvestment(String(data.investment_amount ?? "0"));
          }
        });
    }
  }, [open, batch?.id]);


  const config = SPECIES_CONFIG[species];
  const types = config?.types || [];
  const stageKey = types.length > 0 ? speciesType : "";
  const stages = config?.stages[stageKey] || config?.stages[""] || [];

  const needsAge = ["point_of_cage", "point_of_lay", "grower", "finisher", "weaner", "yearling"].includes(stage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const defaultAge = stage === "pullet" || stage === "chick" || stage === "piglet" || stage === "kid" || stage === "calf" ? 0
      : stage === "point_of_cage" ? 16
        : stage === "point_of_lay" ? 20
          : stage === "weaner" ? 4
            : ageWeeks;

    const batchData: any = {
      branch_id: branchId,
      species,
      species_type: speciesType || null,
      stage,
      age_weeks: needsAge ? ageWeeks : defaultAge,
      quantity,
      current_quantity: batch ? (currentQuantity || quantity) : quantity,
      date_acquired: batch?.date_acquired || new Date().toISOString().split("T")[0],
      source: source || null,
      cost_per_unit: costPerUnit,
      total_cost: costPerUnit * quantity,
      notes: notes || null,
      budget: parseFloat(budget) || 0,
      admin_contribution: parseFloat(adminContribution) || 0,
      has_started_laying: stage === "laying",
      laying_start_date: stage === "laying" ? (batch?.laying_start_date || new Date().toISOString().split("T")[0]) : null,
      registered_by: batch?.registered_by || user.id,
    };


    let error;
    let insertedId: string | null = null;
    if (batch?.id) {
      const { error: updateError } = await supabase
        .from("livestock_batches")
        .update(batchData)
        .eq("id", batch.id);
      error = updateError;
    } else {
      const { data: ins, error: insertError } = await supabase
        .from("livestock_batches")
        .insert(batchData)
        .select("id")
        .single();
      error = insertError;
      insertedId = ins?.id || null;
    }

    if (error) {
      toast.error(`Failed to ${batch ? 'update' : 'register'} batch: ` + error.message);
      setLoading(false);
      return;
    }

    // Partner link handling — create on new batch OR upsert on edit
    const targetBatchId = batch?.id || insertedId;
    if (hasPartner && partnerId && targetBatchId) {
      const linkPayload = {
        partner_id: partnerId,
        batch_id: targetBatchId,
        share_percentage: parseFloat(partnerShare) || 0,
        profit_share_percentage: parseFloat(partnerProfitShare) || 0,
        investment_amount: parseFloat(partnerInvestment) || 0,
      };
      if (existingPartnerLink) {
        const { error: upErr } = await supabase
          .from("partner_batches")
          .update(linkPayload)
          .eq("id", existingPartnerLink.id);
        if (upErr) toast.error("Partner link update failed: " + upErr.message);
        else toast.success("Batch & partner details updated");
      } else {
        const { error: linkErr } = await supabase.from("partner_batches").insert(linkPayload);
        if (linkErr) toast.error("Batch saved, but partner link failed: " + linkErr.message);
        else {
          // Auto-create pending acceptance so partner sees it
          await supabase.from("batch_acceptances").insert([{
            batch_id: targetBatchId,
            partner_id: partnerId,
            admin_contribution_snapshot: parseFloat(adminContribution) || 0,
            accepted_budget: parseFloat(budget) || 0,
          }] as any);
          toast.success("Batch linked; awaiting partner acceptance");
        }
      }
    } else if (!hasPartner && existingPartnerLink) {
      // Toggled off — remove existing link
      await supabase.from("partner_batches").delete().eq("id", existingPartnerLink.id);
      toast.success("Partner unlinked");
    } else {
      toast.success(`Livestock batch ${batch ? 'updated' : 'registered'} successfully!`);
    }

    onOpenChange(false);
    if (!batch) resetForm();
    onSuccess();
    setLoading(false);
  };

  const resetForm = () => {
    setSpecies("");
    setSpeciesType("");
    setStage("");
    setAgeWeeks(0);
    setQuantity(0);
    setCurrentQuantity(0);
    setSource("");
    setCostPerUnit(0);
    setNotes("");
    setBudget("0");
    setHasPartner(false);
    setPartnerId("");
    setPartnerShare("50");
    setPartnerProfitShare("50");
    setPartnerInvestment("0");
    setExistingPartnerLink(null);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{batch ? "Edit Livestock Batch" : "Register New Livestock Batch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Species */}
          <div className="space-y-2">
            <Label>Species *</Label>
            <Select value={species} onValueChange={(v) => { setSpecies(v); setSpeciesType(""); setStage(""); }}>
              <SelectTrigger><SelectValue placeholder="Select species" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chicken">🐔 Chicken</SelectItem>
                <SelectItem value="pig">🐷 Pig</SelectItem>
                <SelectItem value="goat">🐐 Goat</SelectItem>
                <SelectItem value="cattle">🐄 Cattle</SelectItem>
                <SelectItem value="other">🐾 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type (if applicable) */}
          {types.length > 0 && (
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={speciesType} onValueChange={(v) => { setSpeciesType(v); setStage(""); }}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Stage */}
          {stages.length > 0 && (species === "chicken" ? speciesType : true) && (
            <div className="space-y-2">
              <Label>Stage *</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABELS[s] || s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Age (conditional) */}
          {needsAge && (
            <div className="space-y-2">
              <Label>Age (weeks) *</Label>
              <Input
                type="number"
                min={0}
                value={ageWeeks}
                onChange={(e) => setAgeWeeks(parseInt(e.target.value) || 0)}
                placeholder="Age in weeks"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-2">
              <Label>Initial Quantity *</Label>
              <Input
                type="number"
                min={1}
                value={quantity || ""}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="Number of animals"
                required
              />
            </div>

            {/* Current Quantity */}
            {batch && (
              <div className="space-y-2">
                <Label>Current Quantity *</Label>
                <Input
                  type="number"
                  min={0}
                  value={currentQuantity}
                  onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Current number"
                  required
                />
              </div>
            )}
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source *</Label>
            {species !== "chicken" && species ? (
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bought">🏪 Bought from Outside</SelectItem>
                  <SelectItem value="born_on_farm">🐣 Gave Birth To (On Farm)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Where acquired from"
              />
            )}
          </div>

          {/* Cost */}
          <div className="space-y-2">
            <Label>Cost per Unit (₦)</Label>
            <Input
              type="number"
              min={0}
              value={costPerUnit || ""}
              onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            {quantity > 0 && costPerUnit > 0 && (
              <p className="text-xs text-muted-foreground">
                Total: ₦{(quantity * costPerUnit).toLocaleString()}
              </p>
            )}
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Batch Budget (₦)</Label>
              <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Total budget" />
            </div>
            <div className="space-y-2">
              <Label>Admin Contribution (₦)</Label>
              <Input type="number" min={0} value={adminContribution} onChange={(e) => setAdminContribution(e.target.value)} placeholder="Amount admin puts in" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Expenses on this batch reduce the budget. Partner will add their own contribution on acceptance.</p>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this batch..."
            />
          </div>

          {/* Partner toggle — available on both create and edit */}
          <div className="border rounded-lg p-3 bg-primary/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">🤝 Has investment partner?</Label>
                <p className="text-xs text-muted-foreground">
                  {existingPartnerLink ? "Edit or remove this batch's partner link" : "Link this batch to a partner"}
                </p>
              </div>
              <Switch checked={hasPartner} onCheckedChange={setHasPartner} />
            </div>
            {hasPartner && (
              <div className="space-y-2">
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                  <SelectContent>
                    {partners.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No partners yet. Create one in the Partners tab.</div>
                    ) : partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.profiles?.name} • {p.profiles?.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Ownership %</Label>
                    <Input type="number" value={partnerShare} onChange={e => setPartnerShare(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Profit Share %</Label>
                    <Input type="number" value={partnerProfitShare} onChange={e => setPartnerProfitShare(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Investment (₦)</Label>
                    <Input type="number" value={partnerInvestment} onChange={e => setPartnerInvestment(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ownership % = share of animals owned. Profit Share % = share of profits the partner receives.
                </p>
              </div>
            )}
          </div>


          <Button type="submit" className="w-full" disabled={loading || !species || !stage || quantity <= 0}>
            {loading ? (batch ? "Updating..." : "Registering...") : (batch ? "Update Batch" : "Register Batch")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterBatchDialog;
