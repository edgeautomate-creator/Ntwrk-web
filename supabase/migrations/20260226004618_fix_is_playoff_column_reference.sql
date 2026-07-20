/*
  # Fix is_playoff Column Reference in Trigger

  ## Changes
  - Update `update_tournament_standings()` trigger function to use correct column name `is_playoff_match` instead of `is_playoff`
  - The column was created as `is_playoff_match` but the trigger was referencing `is_playoff`
  
  ## Notes
  - This fixes the error: record "new" has no field "is_playoff"
  - The function now correctly checks the `is_playoff_match` column
*/

CREATE OR REPLACE FUNCTION update_tournament_standings()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.team1_score IS NOT NULL AND NEW.team2_score IS NOT NULL AND NOT COALESCE(NEW.is_playoff_match, false) THEN
    INSERT INTO tournament_standings (
      tournament_id,
      team_id,
      wins,
      losses,
      games_won,
      games_lost,
      point_differential
    )
    SELECT 
      NEW.tournament_id,
      NEW.team1_id,
      CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      NEW.team1_score,
      NEW.team2_score,
      (NEW.team1_score - NEW.team2_score)
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      wins = tournament_standings.wins + CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      losses = tournament_standings.losses + CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      games_won = tournament_standings.games_won + NEW.team1_score,
      games_lost = tournament_standings.games_lost + NEW.team2_score,
      point_differential = tournament_standings.point_differential + (NEW.team1_score - NEW.team2_score);

    INSERT INTO tournament_standings (
      tournament_id,
      team_id,
      wins,
      losses,
      games_won,
      games_lost,
      point_differential
    )
    SELECT 
      NEW.tournament_id,
      NEW.team2_id,
      CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      NEW.team2_score,
      NEW.team1_score,
      (NEW.team2_score - NEW.team1_score)
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      wins = tournament_standings.wins + CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      losses = tournament_standings.losses + CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      games_won = tournament_standings.games_won + NEW.team2_score,
      games_lost = tournament_standings.games_lost + NEW.team1_score,
      point_differential = tournament_standings.point_differential + (NEW.team2_score - NEW.team1_score);
  END IF;

  RETURN NEW;
END;
$$;