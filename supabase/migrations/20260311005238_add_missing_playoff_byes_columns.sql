/*
  # Add Missing Playoff Byes System Columns

  1. Schema Updates
    - Add `playoff_byes` to `tournaments` table
      - Number of top teams that get a bye (skip first round)
      - Default: 0 (no byes)
      - Must be >= 0
    
    - Add `seeding_position_team1` to `tournament_matches` table
      - Playoff seed number for team1 (1 = highest seed)
      - Used for bracket generation and display
    
    - Add `seeding_position_team2` to `tournament_matches` table
      - Playoff seed number for team2 (1 = highest seed)
      - Used for bracket generation and display

  2. Notes
    - These columns were missing after the profiles table restoration
    - Required by tournament creation form and playoff bracket generation
    - Restores functionality from migration 20260307220927
*/

-- Add playoff_byes to tournaments table
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS playoff_byes integer DEFAULT 0 CHECK (playoff_byes >= 0);

-- Add seeding_position columns to tournament_matches table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_matches' AND column_name = 'seeding_position_team1') THEN
    ALTER TABLE tournament_matches ADD COLUMN seeding_position_team1 integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_matches' AND column_name = 'seeding_position_team2') THEN
    ALTER TABLE tournament_matches ADD COLUMN seeding_position_team2 integer;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN tournaments.playoff_byes IS 'Number of top-seeded teams that receive a bye (automatic advancement to second round)';
COMMENT ON COLUMN tournament_matches.seeding_position_team1 IS 'Playoff seed number for team1 (1 = highest seed)';
COMMENT ON COLUMN tournament_matches.seeding_position_team2 IS 'Playoff seed number for team2 (1 = highest seed)';