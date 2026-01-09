import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CleaningReminderPopupProps {
  isCleaningDay: boolean;
  isReminderDay: boolean;
  isCleaningCompleted: boolean;
  tasks: string[];
  nextCleaningDate: Date | null;
  onMarkComplete: (notes?: string) => Promise<boolean>;
}

const CleaningReminderPopup = ({
  isCleaningDay,
  isReminderDay,
  isCleaningCompleted,
  tasks,
  nextCleaningDate,
  onMarkComplete,
}: CleaningReminderPopupProps) => {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show popup on reminder day or cleaning day (if not completed)
    if ((isReminderDay || (isCleaningDay && !isCleaningCompleted)) && !sessionStorage.getItem("cleaning-popup-shown")) {
      setOpen(true);
      sessionStorage.setItem("cleaning-popup-shown", "true");
    }
  }, [isReminderDay, isCleaningDay, isCleaningCompleted]);

  const handleMarkComplete = async () => {
    setLoading(true);
    const success = await onMarkComplete(notes || undefined);
    if (success) {
      toast.success("Cleaning marked as complete!");
      setOpen(false);
    } else {
      toast.error("Failed to mark cleaning as complete");
    }
    setLoading(false);
  };

  if (!isReminderDay && !isCleaningDay) return null;
  if (isCleaningDay && isCleaningCompleted) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className={`h-5 w-5 ${isCleaningDay ? 'text-primary' : 'text-warning'}`} />
            {isCleaningDay ? "🧹 Cleaning Day Today!" : "🔔 Cleaning Reminder"}
          </DialogTitle>
          <DialogDescription>
            {isCleaningDay
              ? "Today is scheduled cleaning day. Please complete all cleaning tasks."
              : `Don't forget! Cleaning is scheduled for tomorrow (${nextCleaningDate?.toLocaleDateString()}).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="font-medium text-sm mb-2">Tasks to complete:</p>
            <ul className="space-y-2">
              {tasks.map((task, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  {task}
                </li>
              ))}
            </ul>
          </div>

          {isCleaningDay && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about the cleaning..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-20"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isCleaningDay ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                I'll do it later
              </Button>
              <Button onClick={handleMarkComplete} disabled={loading}>
                {loading ? "Saving..." : "Mark as Complete"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpen(false)}>
              Got it, I'll remember!
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CleaningReminderPopup;
