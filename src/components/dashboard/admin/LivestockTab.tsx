import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AddLivestockDialog from "./dialogs/AddLivestockDialog";
import AddCensusDialog from "./dialogs/AddCensusDialog";
import EditCensusDialog from "./dialogs/EditCensusDialog";
import EditLivestockCategoryDialog from "./dialogs/EditLivestockCategoryDialog";
import DeleteCensusDialog from "./dialogs/DeleteCensusDialog";
import CareLogTemplatesManager from "./livestock/CareLogTemplatesManager";
import WeightGrowthSection from "./livestock/WeightGrowthSection";
import BreedingSection from "./livestock/BreedingSection";
import IncubationSection from "./livestock/IncubationSection";
import { useBranch } from "@/contexts/BranchContext";
import { Sprout, Scale, Dna, Egg } from "lucide-react";

const LivestockTab = () => {
  const { currentBranchId } = useBranch();
  const [categories, setCategories] = useState<any[]>([]);
  const [census, setCensus] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const fetchData = async () => {
    let categoriesQuery = supabase
      .from("livestock_categories")
      .select("*")
      .order("created_at", { ascending: false });
    if (currentBranchId) categoriesQuery = categoriesQuery.eq("branch_id", currentBranchId);
    const { data: categoriesData } = await categoriesQuery;

    let censusQuery = supabase
      .from("livestock_census")
      .select("*, livestock_categories(name)")
      .order("created_at", { ascending: false });
    if (currentBranchId) censusQuery = censusQuery.eq("branch_id", currentBranchId);
    const { data: censusData } = await censusQuery;

    setCategories(categoriesData || []);
    setCensus(censusData || []);
  };

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Livestock Management</h2>
          <p className="text-muted-foreground">Manage livestock categories, census, and depth records</p>
        </div>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Sprout className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="weight" className="flex items-center gap-1">
            <Scale className="h-4 w-4" />
            <span>Weight Curves</span>
          </TabsTrigger>
          <TabsTrigger value="breeding" className="flex items-center gap-1">
            <Dna className="h-4 w-4" />
            <span>Breeding</span>
          </TabsTrigger>
          <TabsTrigger value="incubation" className="flex items-center gap-1">
            <Egg className="h-4 w-4" />
            <span>Incubation</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Livestock Categories</CardTitle>
                  <CardDescription>Define types of livestock</CardDescription>
                </div>
                <AddLivestockDialog onSuccess={fetchData} branchId={currentBranchId} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories added yet</p>
                ) : (
                  categories.map((category) => (
                    <div key={category.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{category.name}</p>
                          {category.description && (
                            <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                          )}
                        </div>
                        <EditLivestockCategoryDialog category={category} onSuccess={fetchData} />
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
                  <CardTitle>Livestock Census</CardTitle>
                  <CardDescription>Track livestock counts</CardDescription>
                </div>
                <AddCensusDialog categories={categories} onSuccess={fetchData} branchId={currentBranchId} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {census.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No census records yet</p>
                ) : (
                  census.map((record) => (
                    <div key={record.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{record.livestock_categories?.name}</p>
                          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                            <span>Initial: {record.total_count}</span>
                            <span className={`font-medium ${record.updated_count < record.total_count ? 'text-destructive' : 'text-foreground'}`}>
                              Current: {record.updated_count}
                            </span>
                          </div>
                          {record.updated_count < record.total_count && (
                            <p className="text-xs text-destructive mt-1">
                              -{record.total_count - record.updated_count} from mortality/sold
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <EditCensusDialog census={record} onSuccess={fetchData} branchId={currentBranchId} />
                          <DeleteCensusDialog census={record} onSuccess={fetchData} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <CareLogTemplatesManager />
      </TabsContent>

      <TabsContent value="weight"><WeightGrowthSection /></TabsContent>
      <TabsContent value="breeding"><BreedingSection /></TabsContent>
      <TabsContent value="incubation"><IncubationSection /></TabsContent>
    </Tabs>
  );
};

export default LivestockTab;
