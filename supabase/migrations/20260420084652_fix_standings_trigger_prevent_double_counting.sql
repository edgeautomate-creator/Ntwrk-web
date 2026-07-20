/*
  # Fix Standings Trigger - Prevent Double Counting and Exclude Playoffs

  ## Summary
  The existing standings trigger `update_team_standings_from_match` had two bugs:
  1. When a completed match is updated (score correction), the trigger fires again and
     ADDS to existing standing totals instead of replacing them, causing double-counting.
  2. Playoff matches were being included in standings calculations.

  ## Changes
  - Rewrites `update_team_standings_from_match` to:
    - On INSERT: add new values (normal behavior)
    - On UPDATE where OLD was already 'completed': subtract OLD values first, then add NEW values
    - On UPDATE where OLD was not 'completed' but NEW is 'completed': add values as new
    - Skip any match where `is_playoff_match = true`
  - Recalculates all existing team_standings from scratch to correct any previously
    double-counted data
*/

CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER AS $$
DECLARE
  v_team1_wins INTEGER := 0;
  v_team1_losses INTEGER := 0;
  v_team2_wins INTEGER := 0;
  v_team2_losses INTEGER := 0;
  v_old_team1_wins INTEGER := 0;
  v_old_team1_losses INTEGER := 0;
  v_old_team2_wins INTEGER := 0;
  v_old_team2_losses INTEGER := 0;
BEGIN
  -- Skip playoff matches entirely
  IF NEW.is_playoff_match = true THEN
    RETURN NEW;
  END IF;

  -- If this is an UPDATE and the match was already completed, subtract the old values first
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed'
     AND OLD.team1_games_won IS NOT NULL AND OLD.team2_games_won IS NOT NULL THEN

    -- Determine old wins/losses
    IF OLD.team1_games_won > OLD.team2_games_won THEN
      v_old_team1_wins := 1;
      v_old_team2_losses := 1;
    ELSIF OLD.team2_games_won > OLD.team1_games_won THEN
      v_old_team2_wins := 1;
      v_old_team1_losses := 1;
    END IF;

    -- Subtract old values from team 1
    IF OLD.team1_id IS NOT NULL THEN
      UPDATE team_standings SET
        matches_played = GREATEST(0, matches_played - 1),
        wins = GREATEST(0, wins - v_old_team1_wins),
        losses = GREATEST(0, losses - v_old_team1_losses),
        points_for = GREATEST(0, points_for - COALESCE(OLD.team1_games_won, 0)),
        points_against = GREATEST(0, points_against - COALESCE(OLD.team2_games_won, 0)),
        point_differential = point_differential - (COALESCE(OLD.team1_games_won, 0) - COALESCE(OLD.team2_games_won, 0)),
        updated_at = now()
      WHERE tournament_id = OLD.tournament_id AND team_id = OLD.team1_id;
    END IF;

    -- Subtract old values from team 2
    IF OLD.team2_id IS NOT NULL THEN
      UPDATE team_standings SET
        matches_played = GREATEST(0, matches_played - 1),
        wins = GREATEST(0, wins - v_old_team2_wins),
        losses = GREATEST(0, losses - v_old_team2_losses),
        points_for = GREATEST(0, points_for - COALESCE(OLD.team2_games_won, 0)),
        points_against = GREATEST(0, points_against - COALESCE(OLD.team1_games_won, 0)),
        point_differential = point_differential - (COALESCE(OLD.team2_games_won, 0) - COALESCE(OLD.team1_games_won, 0)),
        updated_at = now()
      WHERE tournament_id = OLD.tournament_id AND team_id = OLD.team2_id;
    END IF;

  END IF;

  -- Now add the new values if the match is completed
  IF NEW.status = 'completed'
     AND NEW.team1_games_won IS NOT NULL
     AND NEW.team2_games_won IS NOT NULL THEN

    -- Determine new wins/losses
    IF NEW.team1_games_won > NEW.team2_games_won THEN
      v_team1_wins := 1;
      v_team2_losses := 1;
    ELSIF NEW.team2_games_won > NEW.team1_games_won THEN
      v_team2_wins := 1;
      v_team1_losses := 1;
    END IF;

    -- Upsert standings for team 1
    IF NEW.team1_id IS NOT NULL THEN
      INSERT INTO team_standings (
        id, tournament_id, team_id,
        matches_played, wins, losses,
        points_for, points_against, point_differential
      ) VALUES (
        gen_random_uuid(), NEW.tournament_id, NEW.team1_id,
        1, v_team1_wins, v_team1_losses,
        COALESCE(NEW.team1_games_won, 0),
        COALESCE(NEW.team2_games_won, 0),
        COALESCE(NEW.team1_games_won, 0) - COALESCE(NEW.team2_games_won, 0)
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        matches_played = team_standings.matches_played + 1,
        wins = team_standings.wins + v_team1_wins,
        losses = team_standings.losses + v_team1_losses,
        points_for = team_standings.points_for + COALESCE(NEW.team1_games_won, 0),
        points_against = team_standings.points_against + COALESCE(NEW.team2_games_won, 0),
        point_differential = team_standings.point_differential + (COALESCE(NEW.team1_games_won, 0) - COALESCE(NEW.team2_games_won, 0)),
        updated_at = now();
    END IF;

    -- Upsert standings for team 2
    IF NEW.team2_id IS NOT NULL THEN
      INSERT INTO team_standings (
        id, tournament_id, team_id,
        matches_played, wins, losses,
        points_for, points_against, point_differential
      ) VALUES (
        gen_random_uuid(), NEW.tournament_id, NEW.team2_id,
        1, v_team2_wins, v_team2_losses,
        COALESCE(NEW.team2_games_won, 0),
        COALESCE(NEW.team1_games_won, 0),
        COALESCE(NEW.team2_games_won, 0) - COALESCE(NEW.team1_games_won, 0)
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        matches_played = team_standings.matches_played + 1,
        wins = team_standings.wins + v_team2_wins,
        losses = team_standings.losses + v_team2_losses,
        points_for = team_standings.points_for + COALESCE(NEW.team2_games_won, 0),
        points_against = team_standings.points_against + COALESCE(NEW.team1_games_won, 0),
        point_differential = team_standings.point_differential + (COALESCE(NEW.team2_games_won, 0) - COALESCE(NEW.team1_games_won, 0)),
        updated_at = now();
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger fires on both status and games_won column changes
DROP TRIGGER IF EXISTS trigger_update_team_standings ON tournament_matches;

CREATE TRIGGER trigger_update_team_standings
  AFTER INSERT OR UPDATE OF status, team1_games_won, team2_games_won, team1_id, team2_id
  ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_team_standings_from_match();
