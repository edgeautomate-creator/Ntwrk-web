/*
  # Fix Game-Based Scoring Trigger for NULL Team IDs

  1. Problem
    - The trigger function `update_team_standings_from_match()` attempts to insert standings for matches with NULL team IDs
    - Round Robin Individual tournaments use player-based matches (no teams)
    - This causes constraint violations: "null value in column team_id violates not-null constraint"

  2. Solution
    - Add NULL checks for team1_id and team2_id before attempting INSERT operations
    - Only process team standings for team-based matches
    - Skip individual player matches entirely

  3. Changes
    - Update trigger function to check `NEW.team1_id IS NOT NULL` before processing team 1
    - Update trigger function to check `NEW.team2_id IS NOT NULL` before processing team 2
    - Clean up any invalid data (team_standings rows with NULL team_id)

  4. Impact
    - Team-based tournaments continue to work normally
    - Individual player tournaments no longer trigger constraint violations
    - Standings calculations remain accurate for team-based formats
*/

-- First, clean up any invalid data
DELETE FROM team_standings WHERE team_id IS NULL;

-- Drop triggers first, then function
DROP TRIGGER IF EXISTS update_standings_on_match_change ON tournament_matches;
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
        matches_won,
        matches_lost,
        games_won,
        games_lost,
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
        matches_won = team_standings.matches_won + v_team1_wins,
        matches_lost = team_standings.matches_lost + v_team1_losses,
        games_won = team_standings.games_won + COALESCE(NEW.team1_games_won, 0),
        games_lost = team_standings.games_lost + COALESCE(NEW.team2_games_won, 0),
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
        matches_won,
        matches_lost,
        games_won,
        games_lost,
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
        matches_won = team_standings.matches_won + v_team2_wins,
        matches_lost = team_standings.matches_lost + v_team2_losses,
        games_won = team_standings.games_won + COALESCE(NEW.team2_games_won, 0),
        games_lost = team_standings.games_lost + COALESCE(NEW.team1_games_won, 0),
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
