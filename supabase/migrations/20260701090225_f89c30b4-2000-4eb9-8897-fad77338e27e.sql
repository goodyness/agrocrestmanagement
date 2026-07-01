
-- 1. Budget on batches
ALTER TABLE public.livestock_batches ADD COLUMN IF NOT EXISTS budget numeric NOT NULL DEFAULT 0;

-- 2. Profit share on partner_batches (share_percentage kept as ownership)
ALTER TABLE public.partner_batches ADD COLUMN IF NOT EXISTS profit_share_percentage numeric NOT NULL DEFAULT 0;

-- 3. Admin can delete profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- 4. Preserve records when a user is deleted: switch cascade/no-action FKs to SET NULL,
--    and make columns nullable so the FK is legal.
ALTER TABLE public.mortality_records DROP CONSTRAINT IF EXISTS mortality_records_recorded_by_fkey;
ALTER TABLE public.mortality_records ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE public.mortality_records ADD CONSTRAINT mortality_records_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.daily_production DROP CONSTRAINT IF EXISTS daily_production_recorded_by_fkey;
ALTER TABLE public.daily_production ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE public.daily_production ADD CONSTRAINT daily_production_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.miscellaneous_expenses DROP CONSTRAINT IF EXISTS miscellaneous_expenses_created_by_fkey;
ALTER TABLE public.miscellaneous_expenses ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.miscellaneous_expenses ADD CONSTRAINT miscellaneous_expenses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.feed_consumption DROP CONSTRAINT IF EXISTS feed_consumption_recorded_by_fkey;
ALTER TABLE public.feed_consumption ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE public.feed_consumption ADD CONSTRAINT feed_consumption_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.vaccination_records DROP CONSTRAINT IF EXISTS vaccination_records_administered_by_fkey;
ALTER TABLE public.vaccination_records ALTER COLUMN administered_by DROP NOT NULL;
ALTER TABLE public.vaccination_records ADD CONSTRAINT vaccination_records_administered_by_fkey
  FOREIGN KEY (administered_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.livestock_care_logs DROP CONSTRAINT IF EXISTS livestock_care_logs_administered_by_fkey;
ALTER TABLE public.livestock_care_logs ALTER COLUMN administered_by DROP NOT NULL;
ALTER TABLE public.livestock_care_logs ADD CONSTRAINT livestock_care_logs_administered_by_fkey
  FOREIGN KEY (administered_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sales_records DROP CONSTRAINT IF EXISTS sales_records_recorded_by_fkey;
ALTER TABLE public.sales_records ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE public.sales_records ADD CONSTRAINT sales_records_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.livestock_batches DROP CONSTRAINT IF EXISTS livestock_batches_registered_by_fkey;
ALTER TABLE public.livestock_batches ADD CONSTRAINT livestock_batches_registered_by_fkey
  FOREIGN KEY (registered_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
