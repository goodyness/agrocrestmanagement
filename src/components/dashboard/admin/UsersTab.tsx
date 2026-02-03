import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Users, Shield, UserCog, Ban, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import SuspendUserDialog from "./dialogs/SuspendUserDialog";
import { logActivity } from "@/lib/activityLogger";

interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_photo: string | null;
  role: string;
  created_at: string;
  is_suspended?: boolean;
  suspended_at?: string | null;
  suspended_reason?: string | null;
}

const UsersTab = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load users");
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Check if trying to change to admin
    if (newRole === 'admin') {
      const { data: adminCheck } = await supabase.rpc('admin_exists');
      if (adminCheck) {
        toast.error("An admin account already exists. Only one admin is allowed.");
        return;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole as "admin" | "worker" })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to update user role");
    } else {
      toast.success("User role updated successfully");
      fetchUsers();
    }
  };

  const handleSuspendClick = (user: Profile) => {
    setSelectedUser(user);
    setSuspendDialogOpen(true);
  };

  const handleSuspendConfirm = async (reason: string) => {
    if (!selectedUser) return;
    setActionLoading(true);

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error("You must be logged in");
      setActionLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_reason: reason,
        suspended_by: currentUser.id,
      })
      .eq("id", selectedUser.id);

    if (error) {
      toast.error("Failed to suspend user");
    } else {
      await logActivity("update", "user", selectedUser.id, {
        action: "suspended",
        reason,
        user_name: selectedUser.name,
      });
      toast.success(`${selectedUser.name} has been suspended`);
      fetchUsers();
      setSuspendDialogOpen(false);
    }
    setActionLoading(false);
  };

  const handleRestoreUser = async (user: Profile) => {
    setActionLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: false,
        suspended_at: null,
        suspended_reason: null,
        suspended_by: null,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to restore user");
    } else {
      await logActivity("update", "user", user.id, {
        action: "restored",
        user_name: user.name,
      });
      toast.success(`${user.name} has been restored`);
      fetchUsers();
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Loading users...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>User Management</CardTitle>
          </div>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={user.is_suspended ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.profile_photo || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{user.email || "N/A"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{user.phone || "N/A"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
                        {user.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_suspended ? (
                        <div>
                          <Badge variant="destructive" className="mb-1">
                            <Ban className="h-3 w-3 mr-1" />
                            Suspended
                          </Badge>
                          {user.suspended_at && (
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(user.suspended_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-success border-success">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.role !== "admin" && (
                          <>
                            {user.is_suspended ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestoreUser(user)}
                                disabled={actionLoading}
                                className="text-success border-success hover:bg-success/10"
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuspendClick(user)}
                                disabled={actionLoading}
                                className="text-destructive border-destructive hover:bg-destructive/10"
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                Suspend
                              </Button>
                            )}
                          </>
                        )}
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="worker">Worker</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-lg bg-muted/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <CardTitle>Permission Notes</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-primary mt-0.5" />
            <span><strong>Admin:</strong> Full access to all features, can manage users, livestock, feed, expenses, and view all reports</span>
          </p>
          <p className="flex items-start gap-2">
            <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span><strong>Worker:</strong> Can record daily production, sales, feed consumption, and mortality. Cannot manage system settings or users</span>
          </p>
          <p className="flex items-start gap-2">
            <Ban className="h-4 w-4 text-destructive mt-0.5" />
            <span><strong>Suspended:</strong> Cannot access the dashboard or perform any actions until restored by admin</span>
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Note: Only one admin account is allowed per system for security purposes
          </p>
        </CardContent>
      </Card>

      <SuspendUserDialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        userName={selectedUser?.name || ""}
        onConfirm={handleSuspendConfirm}
        loading={actionLoading}
      />
    </div>
  );
};

export default UsersTab;
