import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CreditCard, Loader2 } from "lucide-react";
import UpdatePaymentDialog from "./UpdatePaymentDialog";

interface PendingPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  onUpdate?: () => void;
}

const PendingPaymentsDialog = ({ open, onOpenChange, branchId, onUpdate }: PendingPaymentsDialogProps) => {
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPendingSales();
    }
  }, [open, branchId]);

  const fetchPendingSales = async () => {
    setLoading(true);
    let query = supabase
      .from("sales_records")
      .select("*, profiles(name), customers(name)")
      .in("payment_status", ["pending", "partial"])
      .order("date", { ascending: false });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data } = await query;
    setPendingSales(data || []);
    setLoading(false);
  };

  const handleUpdatePayment = (sale: any) => {
    setSelectedSale(sale);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    fetchPendingSales();
    onUpdate?.();
  };

  const totalPending = pendingSales.reduce((acc, s) => acc + (Number(s.total_amount) - Number(s.amount_paid || 0)), 0);
  const pendingCount = pendingSales.filter(s => s.payment_status === "pending").length;
  const partialCount = pendingSales.filter(s => s.payment_status === "partial").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pending & Partial Payments Summary</DialogTitle>
            <DialogDescription>
              All outstanding payments requiring attention
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-destructive/10 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
              <p className="text-2xl font-bold text-destructive">₦{totalPending.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-destructive/10 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Pending Orders</p>
              <p className="text-2xl font-bold text-destructive">{pendingCount}</p>
            </div>
            <div className="p-4 bg-accent rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Partial Payments</p>
              <p className="text-2xl font-bold text-accent-foreground">{partialCount}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : pendingSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No pending or partial payments found. All payments are up to date!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSales.map((sale) => {
                  const balance = Number(sale.total_amount) - Number(sale.amount_paid || 0);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.date), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="font-medium">{sale.product_name}</TableCell>
                      <TableCell>{sale.quantity} {sale.unit}</TableCell>
                      <TableCell>₦{Number(sale.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-primary">₦{Number(sale.amount_paid || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-destructive">₦{balance.toLocaleString()}</TableCell>
                      <TableCell>{sale.customers?.name || sale.buyer_name || "-"}</TableCell>
                      <TableCell>{sale.profiles?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant={sale.payment_status === "partial" ? "secondary" : "destructive"}>
                          {sale.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdatePayment(sale)}
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <UpdatePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        sale={selectedSale}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
};

export default PendingPaymentsDialog;
