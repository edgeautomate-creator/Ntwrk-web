/*
  # Fix Standings Calculation to Work Correctly

  ## Overview
  Completely fixes the standings calculation to properly track matches_played, 
  wins, losses, points, and point differential based only on regular season matches.

  ## Changes
  1. Recreate trigger function with correct calculation logic
  2. Recalculate all existing standings from scratch
  3. Ensure point_differential is properly maintained

  ## Security
  - Maintains existing RLS policies
  - Uses SECURITY DEFINER for trigger execution
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_update_standings ON tournament_matches;
DROP FUNCTION IF EXISTS update_tournament_standings();

-- Clear existing standings to recalculate from scratch
TRUNCATE team_standings;

-- Create improved function that properly calculates all fields
CREATE OR REPLACE FUNCTION update_tournament_standings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process completed regular season matches (not playoffs)
  IF NEW.status = 'completed' 
     AND NEW.team1_score IS NOT NULL 
     AND NEW.team2_score IS NOT NULL 
     AND COALESCE(NEW.is_playoff_match, false) = false THEN
    
    -- Update standings for team 1
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
    VALUES (
      NEW.tournament_id,
      NEW.team1_id,
      1,
      CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      NEW.team1_score,
      NEW.team2_score,
      NEW.team1_score - NEW.team2_score
    )
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      losses = team_standings.losses + CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      points_for = team_standings.points_for + NEW.team1_score,
      points_against = team_standings.points_against + NEW.team2_score,
      point_differential = (team_standings.points_for + NEW.team1_score) - (team_standings.points_against + NEW.team2_score),
      updated_at = now();

    -- Update standings for team 2
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
    VALUES (
      NEW.tournament_id,
      NEW.team2_id,
      1,
      CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      NEW.team2_score,
      NEW.team1_score,
      NEW.team2_score - NEW.team1_score
    )
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      losses = team_standings.losses + CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      points_for = team_standings.points_for + NEW.team2_score,
      points_against = team_standings.points_against + NEW.team1_score,
      point_differential = (team_standings.points_for + NEW.team2_score) - (team_standings.points_against + NEW.team1_score),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_update_standings
  AFTER INSERT OR UPDATE OF team1_score, team2_score, status
  ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_standings();

-- Backfill standings for all existing completed regular season matches
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
  SUM(CASE WHEN won THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN NOT won THEN 1 ELSE 0 END) as losses,
  SUM(points_for) as points_for,
  SUM(points_against) as points_against,
  SUM(points_for) - SUM(points_against) as point_differential
FROM (
  -- Team 1 perspective
  SELECT 
    tournament_id,
    team1_id as team_id,
    team1_score > team2_score as won,
    team1_score as points_for,
    team2_score as points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team1_score IS NOT NULL
    AND team2_score IS NOT NULL
    AND COALESCE(is_playoff_match, false) = false
  
  UNION ALL
  
  -- Team 2 perspective
  SELECT 
    tournament_id,
    team2_id as team_id,
    team2_score > team1_score as won,
    team2_score as points_for,
    team1_score as points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team1_score IS NOT NULL
    AND team2_score IS NOT NULL
    AND COALESCE(is_playoff_match, false) = false
) matches
GROUP BY tournament_id, team_id
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  matches_played = EXCLUDED.matches_played,
  wins = EXCLUDED.wins,
  losses = EXCLUDED.losses,
  points_for = EXCLUDED.points_for,
  points_against = EXCLUDED.points_against,
  point_differential = EXCLUDED.point_differential,
  updated_at = now();
