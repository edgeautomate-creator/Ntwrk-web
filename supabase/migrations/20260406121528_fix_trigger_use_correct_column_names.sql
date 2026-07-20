/*
  # Fix Trigger to Use Correct Column Names

  1. Problem
    - The trigger function was updated to use new column names (matches_won, games_won, etc.)
    - But the team_standings table still has old column names (wins, points_for, etc.)
    
  2. Solution
    - Update the trigger function to use the actual column names in the table:
      - wins (not matches_won)
      - losses (not matches_lost)
      - points_for (not games_won)
      - points_against (not games_lost)

  3. Changes
    - Recreate trigger function with correct column names
*/

-- Drop and recreate the trigger function with correct column names
DROP TRIGGER IF EXISTS trigger_update_team_standings ON tournament_matches;
DROP FUNCTION IF EXISTS update_team_standings_from_match() CASCADE;

CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER AS $$
DECLARE
  v_team1_wins INTEGER := 0;
  v_team1_losses INTEGER := 0;
  v_team2_wins INTEGER := 0;
  v_team2_losses INTEGER := 0;
BEGIN
  -- Only process completed matches with scores
  IF NEW.status = 'completed' 
     AND NEW.team1_games_won IS NOT NULL 
     AND NEW.team2_games_won IS NOT NULL THEN
    
    -- Determine wins/losses based on games won
    IF NEW.team1_games_won > NEW.team2_games_won THEN
      v_team1_wins := 1;
      v_team2_losses := 1;
    ELSIF NEW.team2_games_won > NEW.team1_games_won THEN
      v_team2_wins := 1;
      v_team1_losses := 1;
    END IF;

    -- Only update standings for team 1 if team1_id is not NULL
    IF NEW.team1_id IS NOT NULL THEN
      INSERT INTO team_standings (
        id,
        tournament_id,
        team_id,
        matches_played,
        wins,
        losses,
        points_for,
        points_against,
        point_differential
      ) VALUES (
        gen_random_uuid(),
        NEW.tournament_id,
        NEW.team1_id,
        1,
        v_team1_wins,
        v_team1_losses,
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

    -- Only update standings for team 2 if team2_id is not NULL
    IF NEW.team2_id IS NOT NULL THEN
      INSERT INTO team_standings (
        id,
        tournament_id,
        team_id,
        matches_played,
        wins,
        losses,
        points_for,
        points_against,
        point_differential
      ) VALUES (
        gen_random_uuid(),
        NEW.tournament_id,
        NEW.team2_id,
        1,
        v_team2_wins,
        v_team2_losses,
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

-- Recreate the trigger
CREATE TRIGGER trigger_update_team_standings
  AFTER INSERT OR UPDATE ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_team_standings_from_match();
