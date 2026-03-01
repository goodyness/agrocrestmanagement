import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, X, AlertTriangle } from "lucide-react";

interface WorkerReviewNotificationProps {
  userId: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WorkerReviewNotification = ({ userId }: WorkerReviewNotificationProps) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchUnseenReviews();
  }, [userId]);

  const fetchUnseenReviews = async () => {
    // Get reviews viewed less than 2 times
    const { data } = await supabase
      .from("worker_reviews")
      .select("*")
      .eq("worker_id", userId)
      .lt("view_count", 2)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      setReviews(data);
      // Increment view count for each
      for (const review of data) {
        await supabase
          .from("worker_reviews")
          .update({ view_count: review.view_count + 1 })
          .eq("id", review.id);
      }
    }
  };

  if (reviews.length === 0 || dismissed) return null;

  const review = reviews[0]; // Show latest review
  const scoreColor = review.score >= 8 ? "text-green-600" : review.score >= 5 ? "text-yellow-600" : "text-destructive";

  return (
    <Card className="border-primary/30 shadow-lg bg-gradient-to-r from-primary/5 to-transparent animate-in slide-in-from-top-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Monthly Review - {MONTHS[review.review_month - 1]} {review.review_year}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Score:</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < review.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
            ))}
          </div>
          <span className={`font-bold ${scoreColor}`}>{review.score}/10</span>
        </div>

        {/* Review text */}
        <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg italic">
          "{review.review_text}"
        </p>

        {/* Debt info if any */}
        {review.total_debt > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-muted-foreground">Outstanding debt:</span>
            <Badge variant="destructive">₦{Number(review.total_debt).toLocaleString()}</Badge>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {review.view_count === 0 ? "This is the first time you're seeing this." : "You've seen this review before. It won't show again after this."}
        </p>
      </CardContent>
    </Card>
  );
};

export default WorkerReviewNotification;
