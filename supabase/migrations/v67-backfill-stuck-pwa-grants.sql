-- v67 — Backfill 4 stuck PWA installers (2026-04-26 cohort).
--
-- These users tapped install + opened the standalone PWA, fired
-- /api/user/claim-pwa-pro, and the endpoint returned `pending: true`
-- under the now-removed 24h gate (commit `9bdd5a9` killed the gate).
-- Their pwa_installed_at is set but pro_via_pwa_until + promo_first_1000_until
-- never landed because the cached client cleared its local flag and never
-- retried.
--
-- Grants (idempotent, only if currently null):
--   - pro_via_pwa_until: pwa_installed_at + 90 days
--   - promo_first_1000_until: 100-year window (founding member)
--   - tier: bumped to 'pro' if currently free/guest
--
-- Cap: stops if global founding cap (1000) is reached. Currently 72/1000
-- so the 4 stuck users fit comfortably.

WITH stuck AS (
  SELECT id, pwa_installed_at, tier
  FROM profiles
  WHERE pwa_installed_at IS NOT NULL
    AND pro_via_pwa_until IS NULL
    AND tier IN ('free','guest')
)
UPDATE profiles p
SET
  pro_via_pwa_until = (s.pwa_installed_at + INTERVAL '90 days'),
  promo_first_1000_until = CASE
    WHEN p.promo_first_1000_until IS NULL
      AND (SELECT COUNT(*) FROM profiles WHERE promo_first_1000_until IS NOT NULL) < 1000
    THEN NOW() + INTERVAL '100 years'
    ELSE p.promo_first_1000_until
  END,
  tier = CASE WHEN p.tier IN ('free','guest') THEN 'pro' ELSE p.tier END
FROM stuck s
WHERE p.id = s.id
RETURNING p.id, p.pro_via_pwa_until, p.promo_first_1000_until, p.tier;
