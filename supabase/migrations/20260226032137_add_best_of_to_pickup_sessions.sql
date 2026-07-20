/*
  # Add best_of field to pickup sessions

  1. Changes
    - Add `best_of` column to pickup_sessions table (values: 1, 3, or 5)
    - Add `best_of` column to pickup_matchups table for consistency
    - Add constraints to ensure valid best_of values

  2. Notes
    - All games are round-robin format
    - Best-of-1: Single game to determine winner
    - Best-of-3: First to win 2 games
    - Best-of-5: First to win 3 games
*/

-- Add best_of to pickup_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_sessions' AND column_name = 'best_of'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN best_of int DEFAULT 3 CHECK (best_of IN (1, 3, 5));
  END IF;
END $$;

-- Add best_of to pickup_matchups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_matchups' AND column_name = 'best_of'
  ) THEN
    ALTER TABLE pickup_matchups ADD COLUMN best_of int DEFAULT 3 CHECK (best_of IN (1, 3, 5));
  END IF;
END $$;

-- Add additional game score columns for best-of-5
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_matchups' AND column_name = 'game4_team1_points'
  ) THEN
    ALTER TABLE pickup_matchups ADD COLUMN game4_team1_points int;
    ALTER TABLE pickup_matchups ADD COLUMN game4_team2_points int;
    ALTER TABLE pickup_matchups ADD COLUMN game5_team1_points int;
    ALTER TABLE pickup_matchups ADD COLUMN game5_team2_points int;
  END IF;
END $$;