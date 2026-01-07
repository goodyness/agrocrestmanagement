import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface AddProductionDialogProps {
  onSuccess: () => void;
}

const AddProductionDialog = ({ onSuccess }: AddProductionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const crates = parseInt(formData.get("crates") as string);
    const pieces = parseInt(formData.get("pieces") as string);
    const comment = formData.get("comment") as string;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("daily_production").insert({
      crates,
      pieces,
      comment: comment || null,
      recorded_by: user.id,
      date: new Date().toISOString().split('T')[0],
    });

    if (error) {
      toast.error("Failed to add production record");
    } else {
      await logActivity("create", "daily_production", undefined, {
        crates,
        pieces,
        total_eggs: (crates * 30) + pieces,
        comment: comment || null,
      });
      
      toast.success("Production recorded successfully");
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="default">
          <TrendingUp className="h-4 w-4 mr-2" />
          Add Production
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Daily Production</DialogTitle>
          <DialogDescription>Enter today's egg production</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crates">Crates</Label>
            <Input
              id="crates"
              name="crates"
              type="number"
              min="0"
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pieces">Pieces</Label>
            <Input
              id="pieces"
              name="pieces"
              type="number"
              min="0"
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Comment (Optional)</Label>
            <Textarea
              id="comment"
              name="comment"
              placeholder="Any notes about today's production..."
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Recording..." : "Record Production"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductionDialog;