
DROP POLICY IF EXISTS "Partners insert linked expenses" ON public.miscellaneous_expenses;
CREATE POLICY "Partners insert linked expenses" ON public.miscellaneous_expenses
  FOR INSERT WITH CHECK (batch_id IS NOT NULL AND public.partner_has_batch(batch_id));
