import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface UpdatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    id: string;
    total_amount: number;
    amount_paid: number;
    payment_status: string;
    product_name: string;
  } | null;
  onSuccess: () => void;
}

const UpdatePaymentDialog = ({ open, onOpenChange, sale, onSuccess }: UpdatePaymentDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [amountPaid, setAmountPaid] = useState<string>("0");

  useEffect(() => {
    if (sale) {
      setPaymentStatus(sale.payment_status);
      setAmountPaid(sale.amount_paid.toString());
    }
  }, [sale]);

  const balanceRemaining = sale ? Number(sale.total_amount) - Number(amountPaid) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;
    
    setLoading(true);

    const paid = parseFloat(amountPaid) || 0;
    let status = paymentStatus;
    
    // Auto-determine status based on amount
    if (paid >= Number(sale.total_amount)) {
      status = 'paid';
    } else if (paid > 0) {
      status = 'partial';
    } else {
      status = 'pending';
    }

    const { error } = await supabase
      .from("sales_records")
      .update({
        payment_status: status,
        amount_paid: paid,
      })
      .eq("id", sale.id);

    if (error) {
      toast.error("Failed to update payment status");
    } else {
      toast.success("Payment status updated");
      onOpenChange(false);
      onSuccess();
    }

    setLoading(false);
  };

  const handleStatusChange = (value: string) => {
    setPaymentStatus(value);
    if (value === 'paid' && sale) {
      setAmountPaid(sale.total_amount.toString());
    } else if (value === 'pending') {
      setAmountPaid("0");
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Payment Status</DialogTitle>
          <DialogDescription>
            Update payment for: {sale.product_name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-xl font-bold">₦{Number(sale.total_amount).toLocaleString()}</p>
          </div>

          <div className="space-y-3">
            <Label>Payment Status</Label>
            <RadioGroup value={paymentStatus} onValueChange={handleStatusChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pending" id="pending" />
                <Label htmlFor="pending" className="font-normal cursor-pointer">Pending</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paid" id="paid" />
                <Label htmlFor="paid" className="font-normal cursor-pointer">Fully Paid</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="font-normal cursor-pointer">Partially Paid</Label>
              </div>
            </RadioGroup>
          </div>

          {paymentStatus === 'partial' && (
            <div className="space-y-2">
              <Label htmlFor="amount_paid">Amount Paid (₦)</Label>
              <Input
                id="amount_paid"
                type="number"
                step="0.01"
                min="0"
                max={sale.total_amount}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                required
              />
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Balance Remaining</p>
                <p className="text-lg font-bold text-destructive">
                  ₦{balanceRemaining > 0 ? balanceRemaining.toLocaleString() : 0}
                </p>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdatePaymentDialog;
