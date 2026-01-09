import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteCensusDialogProps {
  census: {
    id: string;
    livestock_categories?: { name: string } | null;
    updated_count: number;
  };
  onSuccess: () => void;
}

const DeleteCensusDialog = ({ census, onSuccess }: DeleteCensusDialogProps) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    const { error } = await supabase
      .from("livestock_census")
      .delete()
      .eq("id", census.id);

    if (error) {
      toast.error("Failed to delete census record");
    } else {
      toast.success("Census record deleted");
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Census Record</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the census record for "{census.livestock_categories?.name}"?
            <br /><br />
            <span className="font-medium">Current count: {census.updated_count}</span>
            <br /><br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteCensusDialog;
