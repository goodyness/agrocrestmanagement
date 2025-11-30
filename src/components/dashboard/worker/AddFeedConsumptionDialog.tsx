import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { PackageOpen } from "lucide-react";

interface AddFeedConsumptionDialogProps {
  user: User;
  onSuccess: () => void;
}

const AddFeedConsumptionDialog = ({ user, onSuccess }: AddFeedConsumptionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedTypes, setFeedTypes] = useState<any[]>([]);
  const [livestockCategories, setLivestockCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    feed_type_id: "",
    livestock_category_id: "",
    quantity_used: "",
    unit: "kg",
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    const { data: feeds } = await supabase
      .from("feed_types")
      .select("*")
      .order("feed_name");
    
    const { data: livestock } = await supabase
      .from("livestock_categories")
      .select("*")
      .order("name");

    setFeedTypes(feeds || []);
    setLivestockCategories(livestock || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("feed_consumption").insert([
      {
        ...formData,
        quantity_used: parseFloat(formData.quantity_used),
        recorded_by: user.id,
      },
    ]);

    if (error) {
      toast.error("Failed to record feed consumption");
      console.error(error);
    } else {
      toast.success("Feed consumption recorded successfully");
      setOpen(false);
      setFormData({
        feed_type_id: "",
        livestock_category_id: "",
        quantity_used: "",
        unit: "kg",
        date: new Date().toISOString().split('T')[0],
      });
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <PackageOpen className="h-4 w-4 mr-2" />
          Record Feed Usage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Feed Consumption</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Feed Type</Label>
            <Select
              value={formData.feed_type_id}
              onValueChange={(value) => setFormData({ ...formData, feed_type_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select feed type" />
              </SelectTrigger>
              <SelectContent>
                {feedTypes.map((feed) => (
                  <SelectItem key={feed.id} value={feed.id}>
                    {feed.feed_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Livestock Category</Label>
            <Select
              value={formData.livestock_category_id}
              onValueChange={(value) => setFormData({ ...formData, livestock_category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select livestock" />
              </SelectTrigger>
              <SelectContent>
                {livestockCategories.map((livestock) => (
                  <SelectItem key={livestock.id} value={livestock.id}>
                    {livestock.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantity Used</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.quantity_used}
                onChange={(e) => setFormData({ ...formData, quantity_used: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="bag">Bag</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Recording..." : "Record Consumption"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFeedConsumptionDialog;
