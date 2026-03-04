
-- 1. Create bank_accounts table for Finance tab
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view bank accounts"
  ON public.bank_accounts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage bank accounts"
  ON public.bank_accounts FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Create trigger to auto-reduce batch current_quantity on mortality
-- We add a batch_id column to mortality_records to link mortality to specific batches
ALTER TABLE public.mortality_records ADD COLUMN batch_id uuid REFERENCES public.livestock_batches(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.update_batch_on_mortality()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE livestock_batches
    SET current_quantity = GREATEST(current_quantity - NEW.quantity_dead, 0),
        updated_at = NOW()
    WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_batch_on_mortality
  AFTER INSERT ON public.mortality_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_batch_on_mortality();

-- 3. Enable realtime for bank_accounts (so workers see updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;
