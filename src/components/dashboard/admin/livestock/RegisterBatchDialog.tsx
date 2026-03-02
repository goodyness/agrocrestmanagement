import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  branchId: string | null;
}

const SPECIES_CONFIG: Record<string, { types: string[]; stages: Record<string, string[]> }> = {
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

const RegisterBatchDialog = ({ open, onOpenChange, onSuccess, branchId }: Props) => {
  const [loading, setLoading] = useState(false);
  const [species, setSpecies] = useState("");
  const [speciesType, setSpeciesType] = useState("");
  const [stage, setStage] = useState("");
  const [ageWeeks, setAgeWeeks] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [source, setSource] = useState("");
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [notes, setNotes] = useState("");

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

    const { error } = await supabase.from("livestock_batches").insert({
      branch_id: branchId,
      species,
      species_type: speciesType || null,
      stage,
      age_weeks: needsAge ? ageWeeks : defaultAge,
      quantity,
      current_quantity: quantity,
      date_acquired: new Date().toISOString().split("T")[0],
      source: source || null,
      cost_per_unit: costPerUnit,
      total_cost: costPerUnit * quantity,
      notes: notes || null,
      has_started_laying: stage === "laying",
      laying_start_date: stage === "laying" ? new Date().toISOString().split("T")[0] : null,
      registered_by: user.id,
    });

    if (error) {
      toast.error("Failed to register batch: " + error.message);
    } else {
      toast.success("Livestock batch registered successfully!");
      onOpenChange(false);
      resetForm();
      onSuccess();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setSpecies("");
    setSpeciesType("");
    setStage("");
    setAgeWeeks(0);
    setQuantity(0);
    setSource("");
    setCostPerUnit(0);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Livestock Batch</DialogTitle>
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

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Quantity *</Label>
            <Input
              type="number"
              min={1}
              value={quantity || ""}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              placeholder="Number of animals"
              required
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source / Supplier</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Where acquired from"
            />
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

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this batch..."
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !species || !stage || quantity <= 0}>
            {loading ? "Registering..." : "Register Batch"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterBatchDialog;
