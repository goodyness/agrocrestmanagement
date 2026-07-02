
CREATE TABLE IF NOT EXISTS public.partner_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_batch_id UUID NOT NULL REFERENCES public.partner_batches(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_payouts TO authenticated;
GRANT ALL ON public.partner_payouts TO service_role;

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all payouts"
ON public.partner_payouts FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Partners view own payouts"
ON public.partner_payouts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.partner_batches pb
    JOIN public.partners p ON p.id = pb.partner_id
    WHERE pb.id = partner_payouts.partner_batch_id
      AND p.profile_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_pb ON public.partner_payouts(partner_batch_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_partner_payouts_updated ON public.partner_payouts;
CREATE TRIGGER trg_partner_payouts_updated
BEFORE UPDATE ON public.partner_payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_batch_livestock_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name TEXT;
  cat_id UUID;
BEGIN
  IF NEW.livestock_category_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  cat_name := INITCAP(COALESCE(NEW.species_type, NEW.species, 'General'));

  SELECT id INTO cat_id FROM public.livestock_categories
   WHERE LOWER(name) = LOWER(cat_name)
     AND (branch_id IS NOT DISTINCT FROM NEW.branch_id) LIMIT 1;

  IF cat_id IS NULL THEN
    SELECT id INTO cat_id FROM public.livestock_categories
     WHERE LOWER(name) = LOWER(cat_name) LIMIT 1;
  END IF;

  IF cat_id IS NULL THEN
    INSERT INTO public.livestock_categories (name, branch_id, description)
    VALUES (cat_name, NEW.branch_id, 'Auto-created for batch')
    RETURNING id INTO cat_id;
  END IF;

  NEW.livestock_category_id := cat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_batch_category ON public.livestock_batches;
CREATE TRIGGER trg_ensure_batch_category
BEFORE INSERT OR UPDATE ON public.livestock_batches
FOR EACH ROW EXECUTE FUNCTION public.ensure_batch_livestock_category();

DO $$
DECLARE r RECORD; new_id UUID; cname TEXT;
BEGIN
  FOR r IN SELECT id, species, species_type, branch_id FROM public.livestock_batches WHERE livestock_category_id IS NULL LOOP
    cname := INITCAP(COALESCE(r.species_type, r.species, 'General'));
    SELECT id INTO new_id FROM public.livestock_categories
      WHERE LOWER(name) = LOWER(cname) AND (branch_id IS NOT DISTINCT FROM r.branch_id) LIMIT 1;
    IF new_id IS NULL THEN
      SELECT id INTO new_id FROM public.livestock_categories WHERE LOWER(name) = LOWER(cname) LIMIT 1;
    END IF;
    IF new_id IS NULL THEN
      INSERT INTO public.livestock_categories (name, branch_id, description)
      VALUES (cname, r.branch_id, 'Auto-created for batch')
      RETURNING id INTO new_id;
    END IF;
    UPDATE public.livestock_batches SET livestock_category_id = new_id WHERE id = r.id;
  END LOOP;
END $$;
