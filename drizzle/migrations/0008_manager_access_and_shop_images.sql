CREATE TABLE public.farm_managers (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 onboarded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid, phone text, preferences text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_managers TO authenticated;
GRANT ALL ON public.farm_managers TO service_role;
ALTER TABLE public.farm_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_admin ON public.farm_managers FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY manager_self ON public.farm_managers FOR SELECT TO authenticated USING(profile_id=auth.uid());
CREATE TABLE public.manager_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL, content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.manager_notes TO authenticated;
GRANT ALL ON public.manager_notes TO service_role;
ALTER TABLE public.manager_notes ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.is_farm_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='farm_manager');
$$;
CREATE FUNCTION public.manager_can_read(_created_at timestamptz) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.farm_managers m JOIN public.user_roles r ON r.user_id=m.profile_id AND r.role='farm_manager' WHERE m.profile_id=auth.uid() AND m.active AND _created_at>=m.onboarded_at);
$$;
REVOKE ALL ON FUNCTION public.is_farm_manager(),public.manager_can_read(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_farm_manager(),public.manager_can_read(timestamptz) TO authenticated,service_role;
CREATE POLICY manager_own_notes ON public.manager_notes FOR ALL TO authenticated USING(owner_id=auth.uid() AND public.manager_can_read(now())) WITH CHECK(owner_id=auth.uid() AND public.manager_can_read(now()));
CREATE TRIGGER manager_note_updated BEFORE UPDATE ON public.manager_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY manager_read_eggs ON public.daily_production FOR SELECT TO authenticated USING(public.manager_can_read(created_at));
CREATE POLICY manager_read_batch_eggs ON public.batch_egg_production FOR SELECT TO authenticated USING(public.manager_can_read(created_at));
CREATE POLICY manager_read_sales ON public.sales_records FOR SELECT TO authenticated USING(public.manager_can_read(created_at));
CREATE POLICY manager_read_expenses ON public.miscellaneous_expenses FOR SELECT TO authenticated USING(public.manager_can_read(created_at));
DO $$ DECLARE t record; allowed text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  allowed:=CASE
   WHEN t.tablename IN ('daily_production','batch_egg_production','sales_records','miscellaneous_expenses') THEN 'public.manager_can_read(created_at)'
   WHEN t.tablename='profiles' THEN 'id=auth.uid()'
   WHEN t.tablename='user_roles' THEN 'user_id=auth.uid()'
   WHEN t.tablename='farm_managers' THEN 'profile_id=auth.uid()'
   WHEN t.tablename='manager_notes' THEN 'owner_id=auth.uid() AND public.manager_can_read(now())'
   WHEN t.tablename='branches' THEN 'public.manager_can_read(now())'
   ELSE 'false' END;
  EXECUTE format('CREATE POLICY manager_read_boundary ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_farm_manager() OR (%s))',t.tablename,allowed);
  allowed:=CASE WHEN t.tablename='manager_notes' THEN 'owner_id=auth.uid() AND public.manager_can_read(now())' ELSE 'false' END;
  EXECUTE format('CREATE POLICY manager_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_farm_manager() OR (%s))',t.tablename,allowed);
  EXECUTE format('CREATE POLICY manager_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_farm_manager() OR (%s)) WITH CHECK (NOT public.is_farm_manager() OR (%s))',t.tablename,allowed,allowed);
  EXECUTE format('CREATE POLICY manager_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_farm_manager() OR (%s))',t.tablename,allowed);
 END LOOP;
END $$;
CREATE INDEX manager_production_created ON public.daily_production(created_at);
CREATE INDEX manager_batch_production_created ON public.batch_egg_production(created_at);
CREATE INDEX manager_sales_created ON public.sales_records(created_at);
CREATE INDEX manager_expenses_created ON public.miscellaneous_expenses(created_at);
ALTER POLICY market_images_read ON storage.objects USING (
 bucket_id='market-products' AND (public.market_is_admin() OR EXISTS(SELECT 1 FROM public.market_products p WHERE p.active AND (p.image_path=storage.objects.name OR storage.objects.name=ANY(p.image_paths))))
);