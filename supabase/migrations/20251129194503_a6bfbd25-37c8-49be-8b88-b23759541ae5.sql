-- Fix security warnings by setting search_path for functions

-- Recreate is_admin function with proper search_path
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Recreate update_livestock_census function with proper search_path
CREATE OR REPLACE FUNCTION update_livestock_census()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE livestock_census
  SET updated_count = updated_count - NEW.quantity_dead,
      updated_at = NOW()
  WHERE livestock_category_id = NEW.livestock_category_id;
  RETURN NEW;
END;
$$;

-- Recreate handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'worker')
  );
  RETURN NEW;
END;
$$;