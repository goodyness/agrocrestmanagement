import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface EditCensusDialogProps {
  census: {
    id: string;
    total_count: number;
    updated_count: number;
    livestock_category_id: string;
    livestock_categories?: { name: string } | null;
  };
  onSuccess: () => void;
}

const EditCensusDialog = ({ census, onSuccess }: EditCensusDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(census.total_count);
  const [updatedCount, setUpdatedCount] = useState(census.updated_count);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [changeReason, setChangeReason] = useState<"mortality" | "sold" | "new">("mortality");
  const [pendingCount, setPendingCount] = useState(0);

  const handleCountChange = (newCount: number) => {
    if (newCount < census.updated_count) {
      // Count decreased - ask for reason
      setPendingCount(newCount);
      setShowReasonDialog(true);
    } else if (newCount > census.updated_count) {
      // Count increased - automatically consider as new birds
      setUpdatedCount(newCount);
      setTotalCount(prev => prev + (newCount - census.updated_count));
    } else {
      setUpdatedCount(newCount);
    }
  };

  const handleReasonConfirm = async () => {
    const difference = census.updated_count - pendingCount;
    
    if (changeReason === "mortality") {
      // Record mortality
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("mortality_records").insert({
          livestock_category_id: census.livestock_category_id,
          quantity_dead: difference,
          recorded_by: user.id,
          reason: "Recorded via census edit",
        });
        await logActivity("created", "mortality", undefined, {
          category: census.livestock_categories?.name,
          quantity: difference,
          source: "census_edit",
        });
      }
    } else if (changeReason === "sold") {
      await logActivity("updated", "census", census.id, {
        category: census.livestock_categories?.name,
        change: -difference,
        reason: "sold",
      });
    }

    setUpdatedCount(pendingCount);
    setShowReasonDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("livestock_census")
      .update({
        total_count: totalCount,
        updated_count: updatedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", census.id);

    if (error) {
      toast.error("Failed to update census");
    } else {
      toast.success("Census updated successfully");
      await logActivity("updated", "census", census.id, {
        category: census.livestock_categories?.name,
        previousCount: census.updated_count,
        newCount: updatedCount,
      });
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Census: {census.livestock_categories?.name}</DialogTitle>
            <DialogDescription>Update livestock count</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="total">Initial Count</Label>
              <Input
                id="total"
                type="number"
                min="0"
                value={totalCount}
                onChange={(e) => setTotalCount(parseInt(e.target.value) || 0)}
                required
              />
              <p className="text-xs text-muted-foreground">Original count when census was created</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="current">Current Count</Label>
              <Input
                id="current"
                type="number"
                min="0"
                value={updatedCount}
                onChange={(e) => handleCountChange(parseInt(e.target.value) || 0)}
                required
              />
              <p className="text-xs text-muted-foreground">Current livestock count</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Difference: </span>
                <span className={updatedCount < totalCount ? 'text-destructive' : 'text-success'}>
                  {updatedCount - totalCount >= 0 ? '+' : ''}{updatedCount - totalCount}
                </span>
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Census"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reason Dialog */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Decrease</DialogTitle>
            <DialogDescription>
              The count decreased by {census.updated_count - pendingCount}. Please specify the reason.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={changeReason} onValueChange={(v) => setChangeReason(v as any)} className="space-y-3">
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="mortality" id="mortality" />
              <Label htmlFor="mortality" className="flex-1 cursor-pointer">
                <span className="font-medium">Mortality</span>
                <p className="text-xs text-muted-foreground">Birds died - will be recorded in mortality records</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="sold" id="sold" />
              <Label htmlFor="sold" className="flex-1 cursor-pointer">
                <span className="font-medium">Sold</span>
                <p className="text-xs text-muted-foreground">Birds were sold</p>
              </Label>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasonDialog(false)}>Cancel</Button>
            <Button onClick={handleReasonConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditCensusDialog;
