/*
  # Add Missing Tournament Columns
  
  1. Columns Added
    - `playoffs_started` (boolean) - Tracks if playoff bracket has been generated
    - `playoffs_started_at` (timestamptz) - Timestamp when playoffs were initiated
    - `champion_team_id` (uuid) - References the winning team
  
  2. Indexes
    - `idx_tournaments_champion_team_id` - Foreign key index for champion team
  
  3. Notes
    - All columns are nullable to allow tournaments without playoffs
    - Champion team ID references tournament_teams table
    - Idempotent migration using IF NOT EXISTS checks
*/

-- Add playoffs_started column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'playoffs_started'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN playoffs_started boolean DEFAULT false;
  END IF;
END $$;

-- Add playoffs_started_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'playoffs_started_at'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN playoffs_started_at timestamptz;
  END IF;
END $$;

-- Add champion_team_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'champion_team_id'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN champion_team_id uuid REFERENCES tournament_teams(id);
  END IF;
END $$;

-- Create index for champion_team_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_tournaments_champion_team_id ON tournaments(champion_team_id);
