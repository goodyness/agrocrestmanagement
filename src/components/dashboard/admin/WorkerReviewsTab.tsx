import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Star, ClipboardCheck, Pencil, Trash2 } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import WorkerReviewDialog from "./dialogs/WorkerReviewDialog";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WorkerReviewsTab = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { currentBranch } = useBranch();
  const pagination = usePagination({ totalItems: reviews.length, itemsPerPage: 15 });

  useEffect(() => { fetchReviews(); }, [currentBranch]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("worker_reviews")
      .select("*, profiles!worker_reviews_worker_id_fkey(name)")
      .order("review_year", { ascending: false })
      .order("review_month", { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const review = reviews.find(r => r.id === deleteId);
    // Delete linked salary expense
    if (review?.salary_expense_id) {
      await supabase.from("miscellaneous_expenses").delete().eq("id", review.salary_expense_id);
    }
    const { error } = await supabase.from("worker_reviews").delete().eq("id", deleteId);
    if (error) {
      toast.error("Failed to delete review");
    } else {
      toast.success("Review and linked salary expense deleted");
      fetchReviews();
    }
    setDeleteId(null);
    setDeleting(false);
  };

  const paginatedReviews = reviews.slice(
    (pagination.currentPage - 1) * 15,
    pagination.currentPage * 15
  );

  const scoreColor = (s: number) => s >= 8 ? "bg-green-100 text-green-800" : s >= 5 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Worker Reviews</CardTitle>
                <CardDescription>Monthly performance reviews, salary & debt records</CardDescription>
              </div>
            </div>
            <WorkerReviewDialog onSuccess={fetchReviews} branchId={currentBranch?.id || null} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No reviews yet. Write your first worker review.</p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead className="text-right">Salary</TableHead>
                      <TableHead className="text-right">Debt</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium">
                          {review.profiles?.name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          {MONTHS[review.review_month - 1]} {review.review_year}
                        </TableCell>
                        <TableCell>
                          <Badge className={scoreColor(review.score)}>
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            {review.score}/10
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {review.review_text}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ₦{Number(review.salary_amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {review.total_debt > 0 ? (
                            <Badge variant="destructive">₦{Number(review.total_debt).toLocaleString()}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <WorkerReviewDialog
                              onSuccess={fetchReviews}
                              branchId={currentBranch?.id || null}
                              editReview={review}
                              triggerButton={
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(review.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={pagination.goToPage}
                getPageNumbers={pagination.getPageNumbers}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this review and its linked salary expense. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkerReviewsTab;
