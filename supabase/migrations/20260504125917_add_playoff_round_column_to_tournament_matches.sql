/*
  # Add playoff_round column to tournament_matches

  ## Summary
  The `playoff_round` column was referenced in the application code but was absent
  from the live database schema, causing PGRST204 errors when creating or reading
  playoff matches.

  ## Changes
  - `tournament_matches`
    - Add `playoff_round` (text, nullable): stores the round name for playoff matches
      (e.g. "Finals", "Semifinals", "Quarterfinals", "Round of 16")

  ## Backfill
  - For existing rows where `is_playoff_match = true`, copy the value from the
    existing `round` column into `playoff_round` so historical data is consistent.

  ## Indexes
  - Recreate `idx_tournament_matches_playoff_round` on (tournament_id, playoff_round)
    filtered to non-null playoff_round rows for efficient bracket queries.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'playoff_round'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN playoff_round TEXT;
  END IF;
END $$;

-- Backfill existing playoff matches from the round column
UPDATE tournament_matches
SET playoff_round = round
WHERE is_playoff_match = true
  AND playoff_round IS NULL
  AND round IS NOT NULL;

-- Recreate the index for bracket queries
CREATE INDEX IF NOT EXISTS idx_tournament_matches_playoff_round
  ON tournament_matches(tournament_id, playoff_round)
  WHERE playoff_round IS NOT NULL;
