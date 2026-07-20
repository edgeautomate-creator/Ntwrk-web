/*
  # Add King of the Hill Player Tracking Support

  1. Updates to `tournaments` table
    - Add `player_capacity` column for King of the Hill format (stores max number of players)
    - Ensure `best_of` column exists for game series (1, 3, or 5 games)
    
  2. Updates to `tournament_matches` table
    - Add game-by-game score tracking columns (game1_team1_points, game1_team2_points, etc.)
    - Add `round_number` column to group matches into rounds
    - Add `player1_id`, `player2_id`, `player3_id`, `player4_id` for direct player references
    
  3. Updates to `tournament_teams` table
    - Ensure it can handle individual player "teams" (single player entries)
    
  4. Security
    - Update RLS policies as needed
*/

-- Add player_capacity to tournaments table for King of the Hill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'player_capacity'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN player_capacity integer;
  END IF;
END $$;

-- Add game-by-game score columns to tournament_matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game1_team1_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game1_team1_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game1_team2_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game1_team2_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game2_team1_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game2_team1_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game2_team2_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game2_team2_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game3_team1_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game3_team1_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game3_team2_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game3_team2_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game4_team1_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game4_team1_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game4_team2_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game4_team2_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game5_team1_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game5_team1_points integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'game5_team2_points'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN game5_team2_points integer;
  END IF;
END $$;

-- Add round_number to tournament_matches for round-based grouping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'round_number'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN round_number integer;
  END IF;
END $$;

-- Add direct player ID references to tournament_matches for King of the Hill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'player1_id'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN player1_id uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'player2_id'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN player2_id uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'player3_id'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN player3_id uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'player4_id'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN player4_id uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round_number ON tournament_matches(round_number);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player1_id ON tournament_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player2_id ON tournament_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player3_id ON tournament_matches(player3_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player4_id ON tournament_matches(player4_id);
