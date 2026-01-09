import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface VaccinationScheduleDialogProps {
  vaccinationTypes: any[];
  categories: any[];
  onSuccess: () => void;
}

const VaccinationScheduleDialog = ({ vaccinationTypes, categories, onSuccess }: VaccinationScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingSchedules, setExistingSchedules] = useState<any[]>([]);
  const [vaccinationTypeId, setVaccinationTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("2026-01-12");

  useEffect(() => {
    if (open) {
      fetchSchedules();
    }
  }, [open]);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from("vaccination_schedules")
      .select("*, vaccination_types(name, interval_weeks), livestock_categories(name)")
      .order("created_at", { ascending: false });

    setExistingSchedules(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("vaccination_schedules")
      .upsert({
        vaccination_type_id: vaccinationTypeId,
        livestock_category_id: categoryId,
        start_date: startDate,
        is_active: true,
      }, {
        onConflict: "livestock_category_id,vaccination_type_id"
      });

    if (error) {
      toast.error("Failed to create schedule");
    } else {
      toast.success("Vaccination schedule created!");
      setVaccinationTypeId("");
      setCategoryId("");
      fetchSchedules();
      onSuccess();
    }

    setLoading(false);
  };

  const toggleSchedule = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("vaccination_schedules")
      .update({ is_active: !isActive, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update schedule");
    } else {
      fetchSchedules();
      onSuccess();
    }
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase
      .from("vaccination_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete schedule");
    } else {
      toast.success("Schedule deleted");
      fetchSchedules();
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          Manage Schedules
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vaccination Schedules</DialogTitle>
          <DialogDescription>Configure recurring vaccination reminders</DialogDescription>
        </DialogHeader>

        {/* Existing Schedules */}
        {existingSchedules.length > 0 && (
          <div className="space-y-2">
            <Label>Active Schedules</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {existingSchedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{schedule.vaccination_types?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.livestock_categories?.name} • Every {schedule.vaccination_types?.interval_weeks} weeks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started: {format(new Date(schedule.start_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={() => toggleSchedule(schedule.id, schedule.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteSchedule(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Schedule */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
          <Label className="text-base">Add New Schedule</Label>
          
          <div className="space-y-2">
            <Label>Livestock Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))
                }
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vaccination Type</Label>
            <Select value={vaccinationTypeId} onValueChange={setVaccinationTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select vaccination" />
              </SelectTrigger>
              <SelectContent>
                {vaccinationTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} (every {type.interval_weeks} weeks)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">First vaccination date (schedule repeats from here)</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !categoryId || !vaccinationTypeId}>
            {loading ? "Creating..." : "Create Schedule"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VaccinationScheduleDialog;
