import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Filter, Search, User } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const ITEMS_PER_PAGE = 15;

const ActivityTab = () => {
  const { currentBranchId } = useBranch();
  const [activities, setActivities] = useState<any[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    fetchActivities();
  }, [currentBranchId]);

  useEffect(() => {
    let filtered = activities;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.profiles?.name?.toLowerCase().includes(term) ||
        a.action?.toLowerCase().includes(term) ||
        a.entity_type?.toLowerCase().includes(term) ||
        (a.details && JSON.stringify(a.details).toLowerCase().includes(term))
      );
    }
    if (actionFilter !== "all") {
      filtered = filtered.filter(a => a.action?.includes(actionFilter));
    }
    if (entityFilter !== "all") {
      filtered = filtered.filter(a => a.entity_type === entityFilter);
    }
    setFilteredActivities(filtered);
  }, [activities, searchTerm, actionFilter, entityFilter]);

  const fetchActivities = async () => {
    setLoading(true);
    let query = supabase
      .from("activity_logs")
      .select("*, profiles(name)")
      .order("created_at", { ascending: false });
    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    const { data: logs } = await query;
    setActivities(logs || []);
    setLoading(false);
  };

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: filteredActivities.length,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  const paginatedActivities = filteredActivities.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  // Get unique entity types and actions for filters
  const entityTypes = [...new Set(activities.map(a => a.entity_type).filter(Boolean))];
  const actionTypes = [...new Set(activities.map(a => {
    if (a.action?.includes("create") || a.action?.includes("add")) return "create";
    if (a.action?.includes("update") || a.action?.includes("edit")) return "update";
    if (a.action?.includes("delete") || a.action?.includes("remove")) return "delete";
    return "other";
  }))];

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create") || action.includes("add")) return "default";
    if (action.includes("update") || action.includes("edit")) return "secondary";
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    return "outline";
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Activity Timeline
        </h2>
        <p className="text-muted-foreground">Complete audit trail of all farm activities ({filteredActivities.length} events)</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Created</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="delete">Deleted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {entityTypes.map(type => (
                  <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline View */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Showing {paginatedActivities.length} of {filteredActivities.length} activities</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : filteredActivities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activities found</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedActivities.map((activity, idx) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.action?.includes("create") || activity.action?.includes("add") ? "bg-primary/10 text-primary" :
                      activity.action?.includes("delete") || activity.action?.includes("remove") ? "bg-destructive/10 text-destructive" :
                      "bg-secondary/50 text-secondary-foreground"
                    }`}>
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{activity.profiles?.name || "System"}</span>
                        <Badge variant={getActionBadgeColor(activity.action)} className="text-xs">
                          {activity.action}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {activity.entity_type}
                        </Badge>
                      </div>
                      {activity.details && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {typeof activity.details === 'object' ? 
                            Object.entries(activity.details as Record<string, any>)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" • ") 
                            : String(activity.details)
                          }
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {getTimeAgo(activity.created_at)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  getPageNumbers={getPageNumbers}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityTab;
