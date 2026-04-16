/*
 * v27: Session tracking, first-1000 launch promo, and public_assets table.
 * Safe to run multiple times. Every column, index, table, and policy is
 * guarded by IF NOT EXISTS or DROP-then-CREATE.
 *
 * Uses block comments only. Terminals auto-convert dash-dash to em-dash,
 * which breaks line-comment parsing in the Supabase SQL editor.
 */

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_device text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_os text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_browser text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS install_state text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON profiles (last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS profiles_install_state_idx
  ON profiles (install_state) WHERE install_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_last_seen_os_idx
  ON profiles (last_seen_os) WHERE last_seen_os IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_tier_install_state_idx
  ON profiles (tier, install_state);

UPDATE profiles
SET first_seen_at = COALESCE(first_seen_at, created_at)
WHERE first_seen_at IS NULL;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS promo_first_1000_until timestamptz;
CREATE INDEX IF NOT EXISTS profiles_promo_first_1000_idx
  ON profiles (promo_first_1000_until) WHERE promo_first_1000_until IS NOT NULL;

WITH ranked AS (
  SELECT id, created_at,
         ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rank
  FROM profiles
)
UPDATE profiles p
SET promo_first_1000_until = (r.created_at + interval '90 days')
FROM ranked r
WHERE p.id = r.id
  AND r.rank <= 1000
  AND p.promo_first_1000_until IS NULL
  AND p.tier = 'free';

CREATE TABLE IF NOT EXISTS public_assets (
  name text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_assets_select ON public_assets;
CREATE POLICY public_assets_select
  ON public_assets FOR SELECT USING (true);
