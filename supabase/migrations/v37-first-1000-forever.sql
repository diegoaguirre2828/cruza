-- v37-first-1000-forever.sql
-- Grandfathers existing first-1000 claimants: any profile with a
-- promo_first_1000_until set to the old 90-day window (i.e. < now() +
-- 10 years) is extended to now() + 100 years so they don't churn at 90d.
-- Aligns with the updated claim-first-1000 route which now grants a
-- permanent "founding member" Pro status.

UPDATE profiles
SET promo_first_1000_until = now() + interval '100 years'
WHERE promo_first_1000_until IS NOT NULL
  AND promo_first_1000_until < now() + interval '10 years';
