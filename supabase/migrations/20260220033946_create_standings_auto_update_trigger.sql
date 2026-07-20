/*
  # Auto-Update Tournament Standings

  ## Overview
  This migration creates a trigger system that automatically calculates and updates
  tournament standings whenever match scores are entered or updated.

  ## Tables Modified
  - tournament_matches: Adds trigger on INSERT/UPDATE
  - team_standings: Auto-populated based on match results

  ## Trigger Logic
  When a match score is submitted:
  1. Calculate wins/losses for both teams
  2. Track points for/against
  3. Calculate point differential
  4. Update or insert standings records
  5. Sort by wins DESC, then point_differential DESC

  ## Security
  - Trigger runs with SECURITY DEFINER to bypass RLS
  - Only updates standings for completed matches
*/

CREATE OR REPLACE FUNCTION update_tournament_standings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.team1_score IS NOT NULL AND NEW.team2_score IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS trigger_update_standings ON tournament_matches;

CREATE TRIGGER trigger_update_standings
  AFTER INSERT OR UPDATE OF team1_score, team2_score, status
  ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_standings();
