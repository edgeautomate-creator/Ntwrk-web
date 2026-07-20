/*
  # Add DUPR+ Required Subscriptions to Tournaments

  ## Summary
  Adds a new column to the tournaments table that allows tournament creators to
  require players to hold specific DUPR subscription tiers in order to join.

  ## Changes

  ### Modified Tables
  - `tournaments`
    - `dupr_plus_required_subs` (text[], default '{}') - Array of required DUPR subscription
      tier codes. If non-empty, a joining player must have at least one matching entry in their
      dupr_subscriptions_cache.tournaments array. Possible values include:
      BASIC_L1, PREMIUM_L1, PREMIUM_L2, VERIFIED_L1, ULTIMATE_PICKLEBALL_LEAGUE_L1, RESET_MARCH_2026

  ## Notes
  - An empty array means no subscription requirement (backwards-compatible default)
  - This column is only meaningful when is_dupr_required is also true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'dupr_plus_required_subs'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN dupr_plus_required_subs text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
