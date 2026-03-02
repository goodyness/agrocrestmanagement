import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import RegisterBatchDialog from "./RegisterBatchDialog";
import BatchDetailView from "./BatchDetailView";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const SPECIES_ICONS: Record<string, string> = {
  chicken: "🐔",
  pig: "🐷",
  goat: "🐐",
  cattle: "🐄",
  other: "🐾",
};

const LivestockIntakeTab = () => {
  const { currentBranchId } = useBranch();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchBatches = async () => {
    setLoading(true);
    let query = supabase
      .from("livestock_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (currentBranchId) query = query.eq("branch_id", currentBranchId);
    if (filter !== "all") query = query.eq("species", filter);

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load livestock batches");
    } else {
      setBatches(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, [currentBranchId, filter]);

  const { currentPage, totalPages, paginatedRange, goToPage, getPageNumbers } = usePagination({
    totalItems: batches.length,
    itemsPerPage: 10,
  });

  const paginatedItems = batches.slice(paginatedRange.startIndex, paginatedRange.endIndex);

  if (selectedBatch) {
    return (
      <BatchDetailView
        batch={selectedBatch}
        onBack={() => {
          setSelectedBatch(null);
          fetchBatches();
        }}
      />
    );
  }

  const activeBatches = batches.filter((b) => b.is_active);
  const totalAnimals = activeBatches.reduce((sum: number, b: any) => sum + (b.current_quantity || 0), 0);
  const speciesCounts = activeBatches.reduce((acc: Record<string, number>, b: any) => {
    acc[b.species] = (acc[b.species] || 0) + (b.current_quantity || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{activeBatches.length}</p>
            <p className="text-xs text-muted-foreground">Active Batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalAnimals}</p>
            <p className="text-xs text-muted-foreground">Total Animals</p>
          </CardContent>
        </Card>
        {Object.entries(speciesCounts).slice(0, 2).map(([species, count]) => (
          <Card key={species}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{SPECIES_ICONS[species]} {String(count)}</p>
              <p className="text-xs text-muted-foreground capitalize">{species}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 flex-wrap">
          {["all", "chicken", "pig", "goat", "cattle", "other"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
              className="capitalize text-xs"
            >
              {s === "all" ? "All" : `${SPECIES_ICONS[s] || ""} ${s}`}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowRegister(true)}>
          <Plus className="h-4 w-4 mr-1" /> Register Batch
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : paginatedItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No livestock batches registered yet</p>
            <p className="text-sm">Click "Register Batch" to add your first livestock intake</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedItems.map((batch: any) => (
            <Card
              key={batch.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedBatch(batch)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{SPECIES_ICONS[batch.species] || "🐾"}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold capitalize">
                          {batch.species_type || batch.species}
                        </p>
                        <Badge variant={batch.is_active ? "default" : "secondary"} className="text-xs">
                          {batch.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {batch.stage && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {batch.stage.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {batch.current_quantity}/{batch.quantity} animals • Age: {batch.age_weeks} weeks • Acquired: {new Date(batch.date_acquired).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {batch.has_started_laying && (
                      <Badge className="bg-green-500 text-xs">🥚 Laying</Badge>
                    )}
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            getPageNumbers={getPageNumbers}
          />
        </div>
      )}

      <RegisterBatchDialog
        open={showRegister}
        onOpenChange={setShowRegister}
        onSuccess={fetchBatches}
        branchId={currentBranchId}
      />
    </div>
  );
};

export default LivestockIntakeTab;
