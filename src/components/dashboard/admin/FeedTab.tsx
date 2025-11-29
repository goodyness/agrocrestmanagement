import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AddFeedTypeDialog from "./dialogs/AddFeedTypeDialog";
import AddFeedInventoryDialog from "./dialogs/AddFeedInventoryDialog";

const FeedTab = () => {
  const [feedTypes, setFeedTypes] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: typesData } = await supabase
      .from("feed_types")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: inventoryData } = await supabase
      .from("feed_inventory")
      .select("*, feed_types(feed_name, unit_type, price_per_unit)")
      .order("updated_at", { ascending: false });

    setFeedTypes(typesData || []);
    setInventory(inventoryData || []);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Feed Management</h2>
        <p className="text-muted-foreground">Manage feed types and inventory</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Feed Types</CardTitle>
                <CardDescription>Define types of feed and pricing</CardDescription>
              </div>
              <AddFeedTypeDialog onSuccess={fetchData} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feed types added yet</p>
              ) : (
                feedTypes.map((type) => (
                  <div key={type.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-foreground">{type.feed_name}</p>
                        <p className="text-sm text-muted-foreground">Unit: {type.unit_type}</p>
                      </div>
                      <p className="text-sm font-medium text-primary">
                        ₦{Number(type.price_per_unit).toLocaleString()}/{type.unit_type}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Feed Inventory</CardTitle>
                <CardDescription>Current feed stock levels</CardDescription>
              </div>
              <AddFeedInventoryDialog feedTypes={feedTypes} onSuccess={fetchData} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inventory records yet</p>
              ) : (
                inventory.map((item) => (
                  <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-foreground">{item.feed_types?.feed_name}</p>
                        <p className="text-sm text-muted-foreground">
                          ₦{Number(item.feed_types?.price_per_unit).toLocaleString()}/{item.feed_types?.unit_type}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-primary">
                        {item.quantity_in_stock} {item.unit}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FeedTab;