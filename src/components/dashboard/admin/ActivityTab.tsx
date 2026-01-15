import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

const ActivityTab = () => {
  const { currentBranchId } = useBranch();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [currentBranchId]);

  const fetchActivities = async () => {
    setLoading(true);
    let query = supabase
      .from("activity_logs")
      .select("*, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (currentBranchId) {
      query = query.eq("branch_id", currentBranchId);
    }

    const { data: logs } = await query;

    setActivities(logs || []);
    setLoading(false);
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create") || action.includes("add")) return "default";
    if (action.includes("update") || action.includes("edit")) return "secondary";
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Activity Log
        </h2>
        <p className="text-muted-foreground">Track all user actions and changes</p>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Last 100 activities across the system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading activities...</p>
          ) : activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activities recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="hidden md:table-cell">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(activity.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{activity.profiles?.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeColor(activity.action)}>
                          {activity.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{activity.entity_type}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {activity.details ? JSON.stringify(activity.details).substring(0, 100) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityTab;
