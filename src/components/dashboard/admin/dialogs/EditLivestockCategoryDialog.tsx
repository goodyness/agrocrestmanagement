import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface EditLivestockCategoryDialogProps {
  category: {
    id: string;
    name: string;
    description: string | null;
  };
  onSuccess: () => void;
}

const EditLivestockCategoryDialog = ({ category, onSuccess }: EditLivestockCategoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const { error } = await supabase
      .from("livestock_categories")
      .update({
        name,
        description: description || null,
      })
      .eq("id", category.id);

    if (error) {
      toast.error("Failed to update category");
    } else {
      toast.success("Category updated successfully");
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Livestock Category</DialogTitle>
          <DialogDescription>Update category details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={category.name}
              placeholder="e.g., Broilers, Layers, Goats"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={category.description || ""}
              placeholder="Additional details about this livestock category..."
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditLivestockCategoryDialog;
