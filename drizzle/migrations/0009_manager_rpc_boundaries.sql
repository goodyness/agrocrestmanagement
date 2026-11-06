DO $$ DECLARE f record; definition text; BEGIN
 FOR f IN SELECT p.oid,p.proname,p.prosrc FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace='public'::regnamespace AND p.prosecdef AND l.lanname='plpgsql' AND p.prorettype<>'trigger'::regtype LOOP
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mBEGIN\M', 'BEGIN IF public.is_farm_manager() THEN RAISE EXCEPTION ''Farm managers cannot access this operation''; END IF;', 'i');
  EXECUTE definition;
 END LOOP;
END $$;
CREATE FUNCTION public.protect_manager_onboarding() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.onboarded_at IS DISTINCT FROM OLD.onboarded_at THEN RAISE EXCEPTION 'Manager onboarding cannot be changed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_manager_onboarding BEFORE UPDATE ON public.farm_managers FOR EACH ROW EXECUTE FUNCTION public.protect_manager_onboarding();