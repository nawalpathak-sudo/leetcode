-- OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting table: tracks OTP send requests per phone and IP
CREATE TABLE IF NOT EXISTS otp_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_phone ON otp_rate_limits(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_ip ON otp_rate_limits(ip_address, created_at);

-- Auto-cleanup expired OTPs (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
  DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '10 minutes';
  DELETE FROM otp_rate_limits WHERE created_at < NOW() - INTERVAL '10 minutes';
$$ LANGUAGE sql;

-- RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (no public access to OTPs)
-- No permissive policies = blocked for anon/publishable key
