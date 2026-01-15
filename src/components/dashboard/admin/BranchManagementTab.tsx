import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Edit, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

const BranchManagementTab = () => {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["all-branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; location: string }) => {
      const { error } = await supabase.from("branches").insert({
        name: data.name,
        location: data.location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-branches"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch added successfully");
      setAddOpen(false);
    },
    onError: () => {
      toast.error("Failed to add branch");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; location: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("branches")
        .update({
          name: data.name,
          location: data.location || null,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-branches"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch updated successfully");
      setEditBranch(null);
    },
    onError: () => {
      toast.error("Failed to update branch");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("branches")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-branches"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch status updated");
    },
    onError: () => {
      toast.error("Failed to update branch status");
    },
  });

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addMutation.mutate({
      name: formData.get("name") as string,
      location: formData.get("location") as string,
    });
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editBranch) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editBranch.id,
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      is_active: editBranch.is_active,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Branch Management
          </h2>
          <p className="text-muted-foreground">Add, edit, and manage farm branches</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Branch</DialogTitle>
              <DialogDescription>Create a new farm branch location</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name</Label>
                <Input id="name" name="name" placeholder="e.g., Lagos" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (Optional)</Label>
                <Input id="location" name="location" placeholder="e.g., 123 Farm Road, Lagos" />
              </div>
              <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adding..." : "Add Branch"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Loading branches...</p>
        ) : branches.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-8">No branches found</p>
        ) : (
          branches.map((branch) => (
            <Card key={branch.id} className={`relative ${!branch.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {branch.name}
                    </CardTitle>
                    {branch.location && (
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {branch.location}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={branch.is_active ? "default" : "secondary"}>
                    {branch.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={branch.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: branch.id, is_active: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {branch.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <Dialog open={editBranch?.id === branch.id} onOpenChange={(open) => !open && setEditBranch(null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setEditBranch(branch)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Branch</DialogTitle>
                        <DialogDescription>Update branch details</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Branch Name</Label>
                          <Input 
                            id="edit-name" 
                            name="name" 
                            defaultValue={editBranch?.name} 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-location">Location (Optional)</Label>
                          <Input 
                            id="edit-location" 
                            name="location" 
                            defaultValue={editBranch?.location || ""} 
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Created: {new Date(branch.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default BranchManagementTab;
