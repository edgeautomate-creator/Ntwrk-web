/*
  # Add bracket_position to tournament_matches

  1. New Columns
    - `tournament_matches.bracket_position` (integer, nullable) - Position in the playoff bracket for bracket visualization

  2. Changes
    - Adds bracket position tracking for playoff matches
    - Enables proper bracket visualization and match ordering
*/

-- Add bracket_position column to tournament_matches if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'bracket_position'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN bracket_position integer;
  END IF;
END $$;

-- Add index for efficient bracket queries
CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket_position 
  ON tournament_matches(tournament_id, bracket_position) 
  WHERE bracket_position IS NOT NULL;

-- Add comment
COMMENT ON COLUMN tournament_matches.bracket_position IS 
  'Position in the playoff bracket. Used for bracket visualization and match ordering in playoff rounds.';