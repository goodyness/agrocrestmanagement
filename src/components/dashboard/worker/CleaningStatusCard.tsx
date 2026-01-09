import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, CheckCircle2, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";

interface CleaningStatusCardProps {
  nextCleaningDate: Date | null;
  daysUntilCleaning: number;
  isCleaningDay: boolean;
  isCleaningCompleted: boolean;
  tasks: string[];
  onMarkComplete: (notes?: string) => Promise<boolean>;
}

const CleaningStatusCard = ({
  nextCleaningDate,
  daysUntilCleaning,
  isCleaningDay,
  isCleaningCompleted,
  tasks,
  onMarkComplete,
}: CleaningStatusCardProps) => {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMarkComplete = async () => {
    setLoading(true);
    const success = await onMarkComplete(notes || undefined);
    if (success) {
      toast.success("Cleaning marked as complete!");
      setOpen(false);
      setNotes("");
    } else {
      toast.error("Failed to mark cleaning as complete");
    }
    setLoading(false);
  };

  const getStatusColor = () => {
    if (isCleaningCompleted) return "border-l-success";
    if (isCleaningDay) return "border-l-primary";
    if (daysUntilCleaning === 1) return "border-l-warning";
    return "border-l-muted-foreground";
  };

  const getStatusText = () => {
    if (isCleaningCompleted) return "✅ Completed Today";
    if (isCleaningDay) return "🧹 Cleaning Day!";
    if (daysUntilCleaning === 1) return "⏰ Tomorrow";
    return `📅 In ${daysUntilCleaning} days`;
  };

  if (!nextCleaningDate) return null;

  return (
    <Card className={`border-l-4 ${getStatusColor()} shadow-md hover:shadow-lg transition-shadow`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isCleaningDay && !isCleaningCompleted ? 'bg-primary/10' : 'bg-muted'}`}>
            <Sparkles className={`h-4 w-4 ${isCleaningDay && !isCleaningCompleted ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          Farm Cleaning
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {nextCleaningDate.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-lg font-bold ${isCleaningDay && !isCleaningCompleted ? 'text-primary' : 'text-foreground'}`}>
          {getStatusText()}
        </div>
        
        {(isCleaningDay || daysUntilCleaning <= 1) && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tasks:</p>
            <ul className="text-xs space-y-0.5">
              {tasks.map((task, i) => (
                <li key={i} className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                  {task}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isCleaningDay && !isCleaningCompleted && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full mt-2">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Complete Cleaning</DialogTitle>
                <DialogDescription>Mark today's cleaning as complete</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Tasks completed:</p>
                  <ul className="text-sm space-y-1">
                    {tasks.map((task, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complete-notes">Notes (Optional)</Label>
                  <Textarea
                    id="complete-notes"
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleMarkComplete} disabled={loading}>
                  {loading ? "Saving..." : "Confirm Complete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

export default CleaningStatusCard;
