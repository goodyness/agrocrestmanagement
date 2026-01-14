import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(() => {
    return localStorage.getItem("currentBranchId");
  });

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

  // Set default branch to Abeokuta if none selected
  useEffect(() => {
    if (!currentBranchId && branches.length > 0) {
      const abeokuta = branches.find((b) => b.name === "Abeokuta");
      if (abeokuta) {
        setCurrentBranchId(abeokuta.id);
        localStorage.setItem("currentBranchId", abeokuta.id);
      }
    }
  }, [branches, currentBranchId]);

  const handleSetBranchId = (id: string) => {
    setCurrentBranchId(id);
    localStorage.setItem("currentBranchId", id);
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
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
