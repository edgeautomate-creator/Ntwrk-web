/*
  # Fix standings trigger to not override winner_team_id

  1. Changes
    - Updates the update_team_standings_from_match() function
    - Only sets winner_team_id if it's not already set by the calculate_match_scores_trigger
    - Preserves the winner calculated from individual game scores
  
  2. Security
    - No security changes, just logic fix
*/

CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.team1_score IS NOT NULL AND NEW.team2_score IS NOT NULL THEN
    -- Only set winner if not already set (by calculate_match_scores_trigger)
    IF NEW.winner_team_id IS NULL THEN
      IF NEW.team1_score > NEW.team2_score THEN
        NEW.winner_team_id := NEW.team1_id;
      ELSIF NEW.team2_score > NEW.team1_score THEN
        NEW.winner_team_id := NEW.team2_id;
      END IF;
    END IF;

    -- Set completed timestamp if not already set
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;

    -- Update standings for team 1
    INSERT INTO team_standings (tournament_id, team_id, matches_played, wins, losses, points_for, points_against, point_differential)
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
      point_differential = team_standings.point_differential + (NEW.team1_score - NEW.team2_score),
      updated_at = now();

    -- Update standings for team 2
    INSERT INTO team_standings (tournament_id, team_id, matches_played, wins, losses, points_for, points_against, point_differential)
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
      point_differential = team_standings.point_differential + (NEW.team2_score - NEW.team1_score),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;
