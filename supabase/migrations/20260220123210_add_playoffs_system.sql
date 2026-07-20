/*
  # Add Playoffs System to Tournaments

  ## Overview
  Adds playoff functionality to tournaments allowing organizers to start playoffs
  from any round, creating a separate playoff bracket with only qualifying teams.

  ## New Columns
  ### tournaments table
    - `playoffs_started` (boolean): Indicates if playoffs have begun
    - `playoffs_started_at` (timestamptz): When playoffs started
    - `champion_team_id` (uuid): The winning team

  ### tournament_matches table
    - `is_playoff_match` (boolean): Distinguishes playoff matches from regular season
    - `playoff_round` (text): Round name (Quarterfinals, Semifinals, Finals, etc.)
    - `bracket_position` (int): Position in the playoff bracket

  ## Changes
  - Adds playoff tracking columns
  - Maintains existing match history when playoffs start
  - Champion team marked with trophy icon

  ## Security
  - Uses existing RLS policies
  - Indexes added for performance
*/

-- Add playoffs columns to tournaments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'playoffs_started'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN playoffs_started BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'playoffs_started_at'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN playoffs_started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'champion_team_id'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN champion_team_id UUID REFERENCES tournament_teams(id);
  END IF;
END $$;

-- Add playoff columns to tournament_matches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'is_playoff_match'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN is_playoff_match BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'playoff_round'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN playoff_round TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'bracket_position'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN bracket_position INT;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_playoffs_started 
  ON tournaments(playoffs_started) WHERE playoffs_started = true;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_is_playoff 
  ON tournament_matches(tournament_id, is_playoff_match) 
  WHERE is_playoff_match = true;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_playoff_round 
  ON tournament_matches(tournament_id, playoff_round) 
  WHERE playoff_round IS NOT NULL;