-- ============================================================
-- Schema: Referral system for shareable invite links
-- Each user gets a unique referral code (first 8 chars of user ID).
-- At 3 completed referrals the referrer earns 1 month of Pro.
-- Run once in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid REFERENCES auth.users(id) NOT NULL,
  referred_id uuid REFERENCES auth.users(id),
  referral_code text NOT NULL UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can read their own referrals
DROP POLICY IF EXISTS "Users read own referrals" ON referrals;
CREATE POLICY "Users read own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_id);

-- Service role can do everything (used by API routes)
DROP POLICY IF EXISTS "Service role manages referrals" ON referrals;
CREATE POLICY "Service role manages referrals" ON referrals FOR ALL USING (auth.role() = 'service_role');

-- Column on profiles to store when referral-granted Pro expires
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_via_referral_until timestamptz;

-- Optional: track referral link clicks for analytics
CREATE TABLE IF NOT EXISTS referral_clicks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code text NOT NULL,
  user_agent text,
  ip text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON referral_clicks(referral_code);

ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages referral clicks" ON referral_clicks;
CREATE POLICY "Service role manages referral clicks" ON referral_clicks FOR ALL USING (auth.role() = 'service_role');
