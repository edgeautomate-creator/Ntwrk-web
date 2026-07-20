/*
  # Fix Game-Based Scoring Migration - Null Team ID Issue

  1. Changes
    - Rollback the previous migration's data changes
    - Apply the same trigger function (which is correct)
    - Fix the data recalculation to properly filter out null team_ids
    
  2. Root Cause
    - The previous migration filtered team1_id and team2_id separately
    - This allowed rows where the result team_id could still be null
    - Now we add explicit filtering after the UNION to ensure no null team_ids
    
  3. Solution
    - Keep the trigger function changes (correct)
    - Recalculate standings with proper null filtering
    - Only process matches where BOTH teams are assigned
*/

-- The trigger function is already correct from the previous migration
-- We just need to fix the data recalculation

-- Clear all existing standings
TRUNCATE TABLE team_standings;

-- Recalculate standings from all completed matches with proper null filtering
INSERT INTO team_standings (
  tournament_id,
  team_id,
  matches_played,
  wins,
  losses,
  points_for,
  points_against,
  point_differential
)
SELECT
  tournament_id,
  team_id,
  COUNT(*) as matches_played,
  SUM(games_won) as wins,
  SUM(games_lost) as losses,
  SUM(points_for) as points_for,
  SUM(points_against) as points_against,
  SUM(points_for - points_against) as point_differential
FROM (
  -- Team 1 perspective
  SELECT
    tournament_id,
    team1_id as team_id,
    COALESCE(team1_games_won, 0) as games_won,
    COALESCE(team2_games_won, 0) as games_lost,
    team1_score as points_for,
    team2_score as points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team1_id IS NOT NULL
    AND team2_id IS NOT NULL  -- Ensure both teams exist
    AND team1_score IS NOT NULL
    AND team2_score IS NOT NULL
    AND is_playoff_match = false
  
  UNION ALL
  
  -- Team 2 perspective
  SELECT
    tournament_id,
    team2_id as team_id,
    COALESCE(team2_games_won, 0) as games_won,
    COALESCE(team1_games_won, 0) as games_lost,
    team2_score as points_for,
    team1_score as points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team1_id IS NOT NULL  -- Ensure both teams exist
    AND team2_id IS NOT NULL
    AND team1_score IS NOT NULL
    AND team2_score IS NOT NULL
    AND is_playoff_match = false
) combined_stats
WHERE team_id IS NOT NULL  -- Extra safety check after UNION
GROUP BY tournament_id, team_id;
