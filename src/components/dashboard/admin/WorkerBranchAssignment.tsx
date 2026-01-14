import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Users, MapPin, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Worker {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  branch_id: string | null;
}

interface Branch {
  id: string;
  name: string;
}

export function WorkerBranchAssignment() {
  const queryClient = useQueryClient();
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "worker")
        .order("name");
      if (error) throw error;
      return data as Worker[];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ workerId, branchId }: { workerId: string; branchId: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ branch_id: branchId })
        .eq("id", workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers-for-assignment"] });
      toast.success("Worker branch assignment updated");
    },
    onError: (error) => {
      toast.error("Failed to update assignment: " + error.message);
    },
  });

  const handleAssignmentChange = (workerId: string, branchId: string) => {
    setAssignments((prev) => ({ ...prev, [workerId]: branchId }));
  };

  const handleSave = (workerId: string) => {
    const branchId = assignments[workerId];
    if (branchId) {
      updateMutation.mutate({ workerId, branchId });
    }
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId || !branches) return "Unassigned";
    return branches.find((b) => b.id === branchId)?.name || "Unknown";
  };

  if (workersLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading workers...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Worker Branch Assignments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workers && workers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Current Branch</TableHead>
                <TableHead>Assign To</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell>{worker.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={worker.branch_id ? "default" : "outline"}>
                      <MapPin className="h-3 w-3 mr-1" />
                      {getBranchName(worker.branch_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={assignments[worker.id] || worker.branch_id || ""}
                      onValueChange={(value) => handleAssignmentChange(worker.id, value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleSave(worker.id)}
                      disabled={
                        !assignments[worker.id] ||
                        assignments[worker.id] === worker.branch_id ||
                        updateMutation.isPending
                      }
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No workers found. Workers will appear here once they sign up.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
