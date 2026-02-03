-- Allow admins to suspend/restore and manage worker profiles
-- This fixes suspension updates failing due to overly strict UPDATE policies.

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admins can update any profile (suspend/restore, role changes, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile"
    ON public.profiles
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;
