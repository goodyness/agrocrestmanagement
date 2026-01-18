import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Syringe, Calendar, AlertTriangle, CheckCircle, Mail } from "lucide-react";
import { format, addWeeks, differenceInDays, isPast } from "date-fns";
import AddVaccinationDialog from "./dialogs/AddVaccinationDialog";
import AddVaccinationTypeDialog from "./dialogs/AddVaccinationTypeDialog";
import VaccinationScheduleDialog from "./dialogs/VaccinationScheduleDialog";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";

const VaccinationTab = () => {
  const { currentBranchId, currentBranch } = useBranch();
  const [vaccinationTypes, setVaccinationTypes] = useState<any[]>([]);
  const [vaccinationRecords, setVaccinationRecords] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [upcomingVaccinations, setUpcomingVaccinations] = useState<any[]>([]);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let typesQuery = supabase.from("vaccination_types").select("*").order("name");
    if (currentBranchId) typesQuery = typesQuery.eq("branch_id", currentBranchId);

    let recordsQuery = supabase.from("vaccination_records")
      .select("*, vaccination_types(name), livestock_categories(name), profiles(name)")
      .order("administered_date", { ascending: false })
      .limit(20);
    if (currentBranchId) recordsQuery = recordsQuery.eq("branch_id", currentBranchId);

    let schedulesQuery = supabase.from("vaccination_schedules")
      .select("*, vaccination_types(name, interval_weeks), livestock_categories(name)")
      .eq("is_active", true);
    if (currentBranchId) schedulesQuery = schedulesQuery.eq("branch_id", currentBranchId);

    let categoriesQuery = supabase.from("livestock_categories").select("*").order("name");
    if (currentBranchId) categoriesQuery = categoriesQuery.eq("branch_id", currentBranchId);

    const [typesRes, recordsRes, schedulesRes, categoriesRes] = await Promise.all([
      typesQuery,
      recordsQuery,
      schedulesQuery,
      categoriesQuery,
    ]);

    setVaccinationTypes(typesRes.data || []);
    setVaccinationRecords(recordsRes.data || []);
    setSchedules(schedulesRes.data || []);
    setCategories(categoriesRes.data || []);

    // Calculate upcoming vaccinations
    const upcoming: any[] = [];
    (schedulesRes.data || []).forEach((schedule: any) => {
      const startDate = new Date(schedule.start_date);
      const intervalWeeks = schedule.vaccination_types?.interval_weeks || 3;
      
      // Find the next due date
      let nextDue = startDate;
      const today = new Date();
      while (nextDue < today) {
        nextDue = addWeeks(nextDue, intervalWeeks);
      }
      
      const daysUntil = differenceInDays(nextDue, today);
      
      upcoming.push({
        ...schedule,
        nextDueDate: nextDue,
        daysUntil,
        isOverdue: isPast(nextDue) && differenceInDays(today, nextDue) > 0,
        isDueSoon: daysUntil <= 3 && daysUntil >= 0,
      });
    });

    setUpcomingVaccinations(upcoming.sort((a, b) => a.daysUntil - b.daysUntil));
  };

  const sendTestReminder = async () => {
    setSendingReminder(true);
    try {
      const response = await supabase.functions.invoke("send-vaccination-reminder", {
        body: { 
          test: true, 
          branchId: currentBranchId,
          branchName: currentBranch?.name || "All Branches"
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Test vaccination reminder email sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSendingReminder(false);
    }
  };

  const getStatusBadge = (item: any) => {
    if (item.isOverdue) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Overdue</Badge>;
    }
    if (item.isDueSoon) {
      return <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700"><AlertTriangle className="h-3 w-3" /> Due Soon</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3" /> Scheduled</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Vaccination Management</h2>
          <p className="text-muted-foreground">Track vaccinations and schedule reminders</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={sendTestReminder}
            disabled={sendingReminder}
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendingReminder ? "Sending..." : "Send Test Reminder"}
          </Button>
          <AddVaccinationTypeDialog onSuccess={fetchData} branchId={currentBranchId} />
          <VaccinationScheduleDialog 
            vaccinationTypes={vaccinationTypes} 
            categories={categories} 
            onSuccess={fetchData} 
            branchId={currentBranchId}
          />
        </div>
      </div>

      {/* Upcoming Vaccinations Alert */}
      {upcomingVaccinations.some(v => v.isDueSoon || v.isOverdue) && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              Vaccination Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingVaccinations
                .filter(v => v.isDueSoon || v.isOverdue)
                .map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-background rounded-lg">
                    <div>
                      <p className="font-medium">{item.vaccination_types?.name}</p>
                      <p className="text-sm text-muted-foreground">{item.livestock_categories?.name}</p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(item)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(item.nextDueDate, "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vaccination Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5" />
              Vaccination Types
            </CardTitle>
            <CardDescription>Configured vaccines and supplements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vaccinationTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vaccination types added yet</p>
              ) : (
                vaccinationTypes.map((type) => (
                  <div key={type.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-foreground">{type.name}</p>
                        {type.description && (
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        )}
                      </div>
                      <Badge variant="outline">Every {type.interval_weeks} weeks</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Vaccinations
            </CardTitle>
            <CardDescription>Scheduled vaccinations by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingVaccinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vaccination schedules configured</p>
              ) : (
                upcomingVaccinations.map((item) => (
                  <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-foreground">{item.vaccination_types?.name}</p>
                        <p className="text-sm text-muted-foreground">{item.livestock_categories?.name}</p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(item)}
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.daysUntil === 0 ? "Today" : 
                           item.daysUntil === 1 ? "Tomorrow" :
                           item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} days overdue` :
                           `In ${item.daysUntil} days`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vaccination History */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Vaccination History</CardTitle>
              <CardDescription>Recent vaccination records</CardDescription>
            </div>
            <AddVaccinationDialog 
              vaccinationTypes={vaccinationTypes} 
              categories={categories} 
              onSuccess={fetchData} 
              branchId={currentBranchId}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {vaccinationRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vaccination records yet</p>
            ) : (
              vaccinationRecords.map((record) => (
                <div key={record.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{record.vaccination_types?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.livestock_categories?.name} • Administered by {record.profiles?.name}
                      </p>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{format(new Date(record.administered_date), "MMM dd, yyyy")}</p>
                      <p className="text-xs text-muted-foreground">
                        Next due: {format(new Date(record.next_due_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VaccinationTab;
