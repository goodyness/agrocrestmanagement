import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MedicinesSection from "./MedicinesSection";
import SuppliesSection from "./SuppliesSection";
import PurchaseOrdersSection from "./PurchaseOrdersSection";

const InventoryPlusTab = () => {
  return (
    <Tabs defaultValue="medicines" className="space-y-4">
      <TabsList>
        <TabsTrigger value="medicines">Medicines & Vaccines</TabsTrigger>
        <TabsTrigger value="supplies">Supplies</TabsTrigger>
        <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
      </TabsList>
      <TabsContent value="medicines"><MedicinesSection /></TabsContent>
      <TabsContent value="supplies"><SuppliesSection /></TabsContent>
      <TabsContent value="pos"><PurchaseOrdersSection /></TabsContent>
    </Tabs>
  );
};

export default InventoryPlusTab;
