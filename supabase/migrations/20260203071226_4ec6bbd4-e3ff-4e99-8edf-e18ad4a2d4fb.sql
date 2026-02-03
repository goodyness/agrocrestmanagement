-- Add email column to profiles and sync from auth.users

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Create trigger to auto-sync email from auth.users on insert (for new users)
CREATE OR REPLACE FUNCTION public.sync_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_profile_email ON public.profiles;
CREATE TRIGGER sync_profile_email
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_email_from_auth();
