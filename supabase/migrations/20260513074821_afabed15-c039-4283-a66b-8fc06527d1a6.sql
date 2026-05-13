DROP POLICY IF EXISTS "Anyone authenticated can view profit monitors" ON public.profit_monitors;
DROP POLICY IF EXISTS "Only admins can manage profit monitors" ON public.profit_monitors;

CREATE POLICY "Admins can view profit monitors"
ON public.profit_monitors FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert profit monitors"
ON public.profit_monitors FOR INSERT
TO authenticated
WITH CHECK (is_admin() AND auth.uid() = created_by);

CREATE POLICY "Admins can update profit monitors"
ON public.profit_monitors FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete profit monitors"
ON public.profit_monitors FOR DELETE
TO authenticated
USING (is_admin());