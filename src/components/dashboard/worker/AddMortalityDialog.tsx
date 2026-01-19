import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useBranch } from "@/contexts/BranchContext";

interface AddMortalityDialogProps {
  onSuccess: () => void;
  branchId?: string | null;
}

const AddMortalityDialog = ({ onSuccess, branchId }: AddMortalityDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  // Use passed branchId prop if available, otherwise fall back to context
  const { currentBranchId: contextBranchId } = useBranch();
  const effectiveBranchId = branchId !== undefined ? branchId : contextBranchId;

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open, effectiveBranchId]);

  const fetchCategories = async () => {
    let query = supabase.from("livestock_categories").select("*");
    if (effectiveBranchId) {
      query = query.eq("branch_id", effectiveBranchId);
    }
    const { data } = await query;
    setCategories(data || []);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const livestock_category_id = formData.get("category") as string;
    const quantity_dead = parseInt(formData.get("quantity") as string);
    const reason = formData.get("reason") as string;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    // Get user's branch_id from profile if no effectiveBranchId
    let finalBranchId = effectiveBranchId;
    if (!finalBranchId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .single();
      finalBranchId = profile?.branch_id || null;
    }

    const { error } = await supabase.from("mortality_records").insert({
      livestock_category_id,
      quantity_dead,
      reason: reason || null,
      recorded_by: user.id,
      date: new Date().toISOString().split('T')[0],
      branch_id: finalBranchId,
    });

    if (error) {
      toast.error("Failed to add mortality record");
    } else {
      const categoryName = categories.find(c => c.id === livestock_category_id)?.name || 'Unknown';
      
      await logActivity("create", "mortality", undefined, {
        category: categoryName,
        quantity_dead,
        reason: reason || null,
      }, finalBranchId);
      
      toast.success("Mortality recorded successfully");
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="destructive">
          <AlertCircle className="h-4 w-4 mr-2" />
          Add Mortality
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Mortality</DialogTitle>
          <DialogDescription>Report livestock deaths</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Livestock Category</Label>
            <select
              id="category"
              name="category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Dead</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Cause of death or observations..."
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Recording..." : "Record Mortality"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddMortalityDialog;
