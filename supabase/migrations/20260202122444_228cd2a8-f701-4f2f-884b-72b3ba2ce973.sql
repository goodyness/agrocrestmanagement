-- Add suspension fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_suspended boolean NOT NULL DEFAULT false,
ADD COLUMN suspended_at timestamp with time zone,
ADD COLUMN suspended_reason text,
ADD COLUMN suspended_by uuid REFERENCES public.profiles(id);

-- Create index for quick suspended user lookups
CREATE INDEX idx_profiles_suspended ON public.profiles(is_suspended) WHERE is_suspended = true;

-- Add imbalance_threshold to stock_reconciliations for auto-detection
ALTER TABLE public.stock_reconciliations
ADD COLUMN imbalance_detected boolean NOT NULL DEFAULT false,
ADD COLUMN imbalance_notification_sent timestamp with time zone;

-- Create imbalance alerts table
CREATE TABLE public.imbalance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid REFERENCES public.stock_reconciliations(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  discrepancy_crates integer NOT NULL DEFAULT 0,
  discrepancy_pieces integer NOT NULL DEFAULT 0,
  threshold_exceeded boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES public.profiles(id),
  acknowledged_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on imbalance_alerts
ALTER TABLE public.imbalance_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for imbalance_alerts
CREATE POLICY "Anyone authenticated can view imbalance alerts"
ON public.imbalance_alerts FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage imbalance alerts"
ON public.imbalance_alerts FOR ALL
USING (is_admin())
WITH CHECK (is_admin());