import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Branch {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
}

interface BranchContextType {
  branches: Branch[];
  currentBranchId: string | null;
  setCurrentBranchId: (id: string) => void;
  currentBranch: Branch | null;
  isLoading: boolean;
  isSwitching: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(() => {
    return localStorage.getItem("currentBranchId");
  });
  const [isSwitching, setIsSwitching] = useState(false);
  const queryClient = useQueryClient();

  const { data: branches = [], isLoading } = useQuery({
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

  const handleSetBranchId = async (id: string) => {
    if (id === currentBranchId) return;

    setIsSwitching(true);
    setCurrentBranchId(id);
    localStorage.setItem("currentBranchId", id);

    // Invalidate all queries to refresh data for new branch
    await queryClient.invalidateQueries();

    // Small delay to show switching state
    setTimeout(() => {
      setIsSwitching(false);
    }, 300);
  };

  const currentBranch = branches.find((b) => b.id === currentBranchId) || null;

  return (
    <BranchContext.Provider
      value={{
        branches,
        currentBranchId,
        setCurrentBranchId: handleSetBranchId,
        currentBranch,
        isLoading,
        isSwitching,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
};
