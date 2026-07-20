/*
  # Add Games Won Tracking to Tournament Matches

  1. Changes
    - Add `team1_games_won` column to track number of games won by team 1
    - Add `team2_games_won` column to track number of games won by team 2
    - Keep `team1_score` and `team2_score` to represent individual game points
    
  2. Notes
    - This separates the concept of "game points" (team1_score/team2_score) from "games won"
    - Winner determination will now be based on games_won columns
    - Individual game scores will be preserved in the game1_team1_points, game1_team2_points, etc. columns
*/

-- Add games won columns
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS team1_games_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS team2_games_won INTEGER DEFAULT 0;

-- Backfill games won based on existing game scores
UPDATE tournament_matches
SET 
  team1_games_won = (
    CASE WHEN game1_team1_points > game1_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game2_team1_points > game2_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game3_team1_points > game3_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game4_team1_points > game4_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game5_team1_points > game5_team2_points THEN 1 ELSE 0 END
  ),
  team2_games_won = (
    CASE WHEN game1_team2_points > game1_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game2_team2_points > game2_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game3_team2_points > game3_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game4_team2_points > game4_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game5_team2_points > game5_team1_points THEN 1 ELSE 0 END
  )
WHERE game1_team1_points IS NOT NULL OR game1_team2_points IS NOT NULL;