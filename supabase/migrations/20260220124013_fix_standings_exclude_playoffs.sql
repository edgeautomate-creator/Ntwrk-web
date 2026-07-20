/*
  # Fix Standings to Exclude Playoff Matches

  ## Overview
  Updates the standings trigger to only calculate standings from regular season matches,
  not playoff matches. This ensures the standings reflect regular season performance.

  ## Changes
  - Modified trigger to check is_playoff_match flag
  - Only regular season matches (is_playoff_match = false) affect standings
  - Playoff matches are tracked separately and don't influence regular season standings

  ## Security
  - Maintains existing RLS policies
  - Uses SECURITY DEFINER for trigger execution
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_update_standings ON tournament_matches;
DROP FUNCTION IF EXISTS update_tournament_standings();

-- Recreate function with playoff exclusion
CREATE OR REPLACE FUNCTION update_tournament_standings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update standings for regular season matches (not playoffs)
  IF NEW.status = 'completed' 
     AND NEW.team1_score IS NOT NULL 
     AND NEW.team2_score IS NOT NULL 
     AND (NEW.is_playoff_match = false OR NEW.is_playoff_match IS NULL) THEN
    
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
    SELECT 
      NEW.tournament_id,
      NEW.team1_id,
      1,
      CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      NEW.team1_score,
      NEW.team2_score,
      NEW.team1_score - NEW.team2_score
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      losses = team_standings.losses + CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      points_for = team_standings.points_for + NEW.team1_score,
      points_against = team_standings.points_against + NEW.team2_score,
      point_differential = team_standings.point_differential + (NEW.team1_score - NEW.team2_score);

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
    SELECT 
      NEW.tournament_id,
      NEW.team2_id,
      1,
      CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      NEW.team2_score,
      NEW.team1_score,
      NEW.team2_score - NEW.team1_score
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      losses = team_standings.losses + CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      points_for = team_standings.points_for + NEW.team2_score,
      points_against = team_standings.points_against + NEW.team1_score,
      point_differential = team_standings.point_differential + (NEW.team2_score - NEW.team1_score);
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