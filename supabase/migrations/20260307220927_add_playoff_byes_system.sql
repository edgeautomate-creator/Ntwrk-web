/*
  # Add Playoff Bye System for Top Seeds
  
  1. Schema Updates
    - Add `playoff_byes` to `tournaments` table
      - Number of top teams that get a bye (skip first round)
      - Default: 0 (no byes)
      - Must be less than playoff_teams
    
    - Add `playoff_byes` to `pickup_sessions` table
      - Number of top players/teams that get a bye
      - Default: 0 (no byes)
      - Must be less than playoff_qualifiers
    
    - Add `playoff_byes` to `seasons` table
      - Number of top teams that get a bye in league playoffs
      - Default: 0 (no byes)
      - Must be less than playoff_teams
    
    - Add `seeding_position` to playoff-related tables
      - Tracks seed number (1st seed, 2nd seed, etc.)
      - Used for bracket generation and display
  
  2. Constraints
    - playoff_byes must be >= 0
    - playoff_byes should create valid bracket structure
    - Common valid configurations: 0, 2, or 4 byes depending on team count
  
  3. Notes
    - Bye system rewards top performers with automatic advancement
    - Top N seeds skip first round and enter in second round
    - Remaining teams play first round, winners advance to face bye teams
    - Standard bracket pairing: #1 seed faces lowest advancing seed
*/

-- Add playoff_byes to tournaments table
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS playoff_byes integer DEFAULT 0 CHECK (playoff_byes >= 0);

-- Add playoff_byes to pickup_sessions table
ALTER TABLE pickup_sessions
  ADD COLUMN IF NOT EXISTS playoff_byes integer DEFAULT 0 CHECK (playoff_byes >= 0);

-- Add playoff_byes to seasons table (for leagues)
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS playoff_byes integer DEFAULT 0 CHECK (playoff_byes >= 0);

-- Add seeding_position to tournament_matches for playoff seeding
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_matches' AND column_name = 'seeding_position_team1') THEN
    ALTER TABLE tournament_matches ADD COLUMN seeding_position_team1 integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_matches' AND column_name = 'seeding_position_team2') THEN
    ALTER TABLE tournament_matches ADD COLUMN seeding_position_team2 integer;
  END IF;
END $$;

-- Add seeding_position to pickup_playoff_matchups
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_playoff_matchups' AND column_name = 'seed_a') THEN
    ALTER TABLE pickup_playoff_matchups ADD COLUMN seed_a integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_playoff_matchups' AND column_name = 'seed_b') THEN
    ALTER TABLE pickup_playoff_matchups ADD COLUMN seed_b integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_playoff_matchups' AND column_name = 'seed_team1') THEN
    ALTER TABLE pickup_playoff_matchups ADD COLUMN seed_team1 integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_playoff_matchups' AND column_name = 'seed_team2') THEN
    ALTER TABLE pickup_playoff_matchups ADD COLUMN seed_team2 integer;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN tournaments.playoff_byes IS 'Number of top-seeded teams that receive a bye (automatic advancement to second round)';
COMMENT ON COLUMN pickup_sessions.playoff_byes IS 'Number of top-seeded players/teams that receive a bye in playoffs';
COMMENT ON COLUMN seasons.playoff_byes IS 'Number of top-seeded teams that receive a bye in league playoffs';
COMMENT ON COLUMN tournament_matches.seeding_position_team1 IS 'Playoff seed number for team1 (1 = highest seed)';
COMMENT ON COLUMN tournament_matches.seeding_position_team2 IS 'Playoff seed number for team2 (1 = highest seed)';
