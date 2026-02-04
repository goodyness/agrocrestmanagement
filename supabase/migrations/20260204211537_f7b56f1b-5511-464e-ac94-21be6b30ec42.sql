-- Create table to store password reset OTP tokens
CREATE TABLE public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserting tokens (service role only via edge function)
-- No public policies needed as this is only accessed via edge functions with service role

-- Index for quick lookup by email and code
CREATE INDEX idx_password_reset_tokens_email ON public.password_reset_tokens(email);
CREATE INDEX idx_password_reset_tokens_otp ON public.password_reset_tokens(otp_code);

-- Clean up expired tokens automatically
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_tokens()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.password_reset_tokens 
  WHERE expires_at < now() OR used = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER cleanup_old_tokens
  AFTER INSERT ON public.password_reset_tokens
  EXECUTE FUNCTION public.cleanup_expired_otp_tokens();