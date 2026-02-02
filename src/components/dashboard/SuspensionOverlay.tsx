import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface SuspensionOverlayProps {
  userName: string;
  userEmail: string;
  reason: string;
  suspendedAt: string;
}

const SuspensionOverlay = ({ userName, userEmail, reason, suspendedAt }: SuspensionOverlayProps) => {
  const suspensionDuration = formatDistanceToNow(new Date(suspendedAt), { addSuffix: false });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred background overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      
      {/* Suspension notice */}
      <Card className="relative z-10 max-w-md mx-4 border-destructive/50 shadow-2xl">
        <CardHeader className="text-center bg-destructive/10 rounded-t-lg">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-destructive text-2xl">Account Suspended</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">{userName}</p>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>

          <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <h4 className="text-sm font-medium text-destructive mb-2">Reason for Suspension:</h4>
            <p className="text-sm text-foreground">{reason}</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Clock className="h-4 w-4" />
            <span>
              You have been suspended for <strong className="text-foreground">{suspensionDuration}</strong>
            </span>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Please contact the administrator to resolve this issue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuspensionOverlay;
