-- OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup expired OTPs (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
  DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '10 minutes';
$$ LANGUAGE sql;

-- RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (no public access to OTPs)
-- No permissive policies = blocked for anon/publishable key
