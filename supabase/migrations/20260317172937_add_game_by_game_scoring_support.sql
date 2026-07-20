/*
  # Add Game-by-Game Scoring Support

  1. Changes to tournament_matches table
    - Add `match_status` column to track: 'pending', 'in_progress', 'completed'
    - Add `current_game` column to track which game is currently being played (0-5)
    - These fields enable game-by-game score submission instead of all-at-once

  2. Data Migration
    - Set `match_status` to 'completed' for matches with scores
    - Set `match_status` to 'pending' for matches without scores
    - Calculate `current_game` based on highest game number with scores

  3. Purpose
    - Allow users to submit individual game scores as they're played
    - Track match progress in real-time
    - Better UX for live tournament scoring
*/

-- Add new columns to tournament_matches
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS match_status text DEFAULT 'pending' CHECK (match_status IN ('pending', 'in_progress', 'completed')),
ADD COLUMN IF NOT EXISTS current_game integer DEFAULT 0 CHECK (current_game >= 0 AND current_game <= 5);

-- Backfill match_status based on existing data
UPDATE tournament_matches
SET match_status = CASE
  WHEN team1_score IS NOT NULL AND team2_score IS NOT NULL THEN 'completed'
  WHEN game1_team1_points IS NOT NULL OR game1_team2_points IS NOT NULL THEN 'in_progress'
  ELSE 'pending'
END
WHERE match_status = 'pending';

-- Backfill current_game based on existing game scores
UPDATE tournament_matches
SET current_game = CASE
  WHEN game5_team1_points IS NOT NULL OR game5_team2_points IS NOT NULL THEN 5
  WHEN game4_team1_points IS NOT NULL OR game4_team2_points IS NOT NULL THEN 4
  WHEN game3_team1_points IS NOT NULL OR game3_team2_points IS NOT NULL THEN 3
  WHEN game2_team1_points IS NOT NULL OR game2_team2_points IS NOT NULL THEN 2
  WHEN game1_team1_points IS NOT NULL OR game1_team2_points IS NOT NULL THEN 1
  ELSE 0
END
WHERE current_game = 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(match_status);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_current_game ON tournament_matches(current_game);
