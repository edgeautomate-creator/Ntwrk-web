/*
  # Add entitlements JSONB column to dupr_subscriptions_cache

  ## Changes
  - Adds `entitlements` JSONB column to store the full raw entitlements object from DUPR
  - This future-proofs the cache against new entitlement types without requiring schema changes
  - The existing `tournaments` and `merchandise` array columns remain as convenient typed extractions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dupr_subscriptions_cache' AND column_name = 'entitlements'
  ) THEN
    ALTER TABLE dupr_subscriptions_cache ADD COLUMN entitlements jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
