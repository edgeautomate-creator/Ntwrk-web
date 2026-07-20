/*
  # Add Pool Play Configuration to Tournaments

  ## Summary
  Adds pool play as a standalone, optional feature for team-based tournaments.
  Pool play allows organizers to divide teams into pools, limit the number of
  opponents each team faces within their pool, configure how many teams advance
  from each pool, and give bye slots to top pool finishers.

  ## New Columns on `tournaments`

  - `pool_play_enabled` (boolean, default false) — master toggle for pool play
  - `teams_per_pool` (integer, nullable) — how many teams are placed in each pool
  - `games_per_pool` (integer, nullable) — how many opponents each team plays within its pool (< teams_per_pool)
  - `pool_advance_count` (integer, nullable) — how many top teams per pool advance by standings
  - `pool_bye_count` (integer, nullable) — how many advancing teams (top 1 per pool = pool winners) receive a bye into the later phase

  ## Notes
  - All new columns are nullable with safe defaults so existing tournament rows are unaffected
  - Pool play is completely independent from the existing `groups_enabled` feature
  - No existing columns, triggers, or RLS policies are modified
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'pool_play_enabled'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN pool_play_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'teams_per_pool'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN teams_per_pool integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'games_per_pool'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN games_per_pool integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'pool_advance_count'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN pool_advance_count integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'pool_bye_count'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN pool_bye_count integer;
  END IF;
END $$;
