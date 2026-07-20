/*
  # Add pool_name to tournament_teams and tournament_matches

  ## Summary
  Adds pool tracking columns to support pool play tournaments.

  ## Changes

  ### tournament_teams
  - `pool_name` (text, nullable): Which pool a team belongs to (e.g. "Pool 1", "Pool 2")
  - `pool_position` (integer, nullable): Seeding position within the pool (1-indexed)

  ### tournament_matches
  - `pool_name` (text, nullable): Which pool this match belongs to. Used to group matches
    and standings per pool when pool_play_enabled is true on the tournament.

  ## Notes
  - Both columns are nullable so existing tournaments are unaffected.
  - No RLS changes required — these columns are part of existing tables with existing policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_teams' AND column_name = 'pool_name'
  ) THEN
    ALTER TABLE tournament_teams ADD COLUMN pool_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_teams' AND column_name = 'pool_position'
  ) THEN
    ALTER TABLE tournament_teams ADD COLUMN pool_position integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'pool_name'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN pool_name text;
  END IF;
END $$;
