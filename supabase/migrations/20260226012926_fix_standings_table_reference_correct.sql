/*
  # Fix Standings Table Reference

  ## Changes
  - Update `update_tournament_standings()` trigger function to use correct table name `team_standings` instead of `tournament_standings`
  - Use correct column names: `matches_played`, `points_for`, `points_against` instead of `games_won`, `games_lost`
  - Fix column reference from `is_playoff` to `is_playoff_match`
  
  ## Notes
  - This fixes the error: relation "tournament_standings" does not exist
  - The correct table name has always been `team_standings`
*/

CREATE OR REPLACE FUNCTION update_tournament_standings()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
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
$$;