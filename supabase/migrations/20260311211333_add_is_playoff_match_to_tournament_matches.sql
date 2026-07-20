/*
  # Add is_playoff_match Column to Tournament Matches

  1. Changes
    - Add `is_playoff_match` boolean column to `tournament_matches` table
    - Defaults to false for existing matches (assumes they are regular season matches)
    - NOT NULL constraint with default value

  2. Purpose
    - Distinguishes between regular season matches and playoff matches
    - Used for filtering and displaying different match types
    - Enables proper standings calculations that exclude playoff matches
*/

-- Add is_playoff_match column to tournament_matches
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS is_playoff_match boolean DEFAULT false NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tournament_matches.is_playoff_match IS 
  'Indicates whether this match is part of the playoff bracket (true) or regular season (false)';
