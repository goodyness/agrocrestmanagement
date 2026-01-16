import { useBranch } from "@/contexts/BranchContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Loader2 } from "lucide-react";

export function BranchSelector() {
  const { branches, currentBranchId, setCurrentBranchId, isLoading, isSwitching } = useBranch();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isSwitching ? (
        <Loader2 className="h-4 w-4 text-primary animate-spin" />
      ) : (
        <MapPin className="h-4 w-4 text-primary" />
      )}
      <Select 
        value={currentBranchId || ""} 
        onValueChange={setCurrentBranchId}
        disabled={isSwitching}
      >
        <SelectTrigger className={`w-[160px] ${isSwitching ? 'opacity-70' : ''}`}>
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSwitching && (
        <span className="text-xs text-muted-foreground animate-pulse">Switching...</span>
      )}
    </div>
  );
}
