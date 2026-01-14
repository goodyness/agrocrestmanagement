import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, Building2 } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  location: string | null;
}

interface BranchSelectionPromptProps {
  userId: string;
  userBranchId: string | null;
}

export function BranchSelectionPrompt({ userId, userBranchId }: BranchSelectionPromptProps) {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

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

  useEffect(() => {
    // Show prompt if user has no branch assigned
    if (userBranchId === null && branches && branches.length > 0) {
      setIsOpen(true);
    }
  }, [userBranchId, branches]);

  const updateBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      // Workers cannot update their own branch_id due to RLS, so we'll need admin to assign
      // For now, show a message
      throw new Error("Please contact your admin to assign you to a branch");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setIsOpen(false);
      toast.success("Branch assignment updated!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleConfirm = () => {
    if (selectedBranch) {
      updateBranchMutation.mutate(selectedBranch);
    }
  };

  if (!branches || branches.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Select Your Work Branch
          </DialogTitle>
          <DialogDescription>
            Please select which branch you work at. This will determine which farm data you can access and record.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedBranch} onValueChange={setSelectedBranch}>
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                onClick={() => setSelectedBranch(branch.id)}
              >
                <RadioGroupItem value={branch.id} id={branch.id} />
                <Label htmlFor={branch.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{branch.name}</span>
                  </div>
                  {branch.location && (
                    <p className="text-sm text-muted-foreground ml-6">{branch.location}</p>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> Your admin will need to officially assign you to a branch. 
            Please contact your administrator to complete your branch assignment.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            onClick={handleConfirm}
            disabled={!selectedBranch || updateBranchMutation.isPending}
          >
            Request Assignment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
