/*
  # Create Triggers for Automatic Player Count Tracking

  1. New Function
    - `update_tournament_player_count()` - Calculates and updates player count based on tournament format
    
  2. New Triggers
    - After INSERT on tournament_teams: Increment count when players are added
    - After UPDATE on tournament_teams: Adjust count when players are added/removed from slots
    - After DELETE on tournament_teams: Decrement count when team record is deleted

  3. Logic
    - For round_robin_individual format:
      - Counts each individual filled player slot (player1_name and player2_name independently)
    - For team-based formats:
      - singles (1 player per team): Counts teams where player1_name is not null
      - doubles (2 players per team): Counts teams where both player1_name and player2_name are not null
    
  4. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Ensures accurate counts even with complex RLS policies
*/

-- Drop existing triggers and function if they exist
DROP TRIGGER IF EXISTS tournament_teams_insert_count ON tournament_teams;
DROP TRIGGER IF EXISTS tournament_teams_update_count ON tournament_teams;
DROP TRIGGER IF EXISTS tournament_teams_delete_count ON tournament_teams;
DROP FUNCTION IF EXISTS update_tournament_player_count();

-- Create function to update tournament player count
CREATE OR REPLACE FUNCTION update_tournament_player_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tournament_id uuid;
  v_format text;
  v_registration_type text;
  v_team_format text;
  v_new_count integer := 0;
BEGIN
  -- Determine which tournament to update
  IF TG_OP = 'DELETE' THEN
    v_tournament_id := OLD.tournament_id;
  ELSE
    v_tournament_id := NEW.tournament_id;
  END IF;

  -- Get tournament format and registration type
  SELECT format, registration_type, team_format
  INTO v_format, v_registration_type, v_team_format
  FROM tournaments
  WHERE id = v_tournament_id;

  -- Calculate count based on tournament type
  IF v_format = 'round_robin_individual' OR v_registration_type = 'individual' THEN
    -- For individual tournaments, count each filled player slot
    SELECT 
      COALESCE(SUM(
        (CASE WHEN player1_name IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN player2_name IS NOT NULL THEN 1 ELSE 0 END)
      ), 0)::integer
    INTO v_new_count
    FROM tournament_teams
    WHERE tournament_id = v_tournament_id;
  ELSIF v_team_format = 'singles' THEN
    -- For singles team tournaments, count teams with player1 filled
    SELECT COUNT(*)::integer
    INTO v_new_count
    FROM tournament_teams
    WHERE tournament_id = v_tournament_id
    AND player1_name IS NOT NULL;
  ELSE
    -- For doubles team tournaments, count teams with both players filled
    SELECT COUNT(*)::integer
    INTO v_new_count
    FROM tournament_teams
    WHERE tournament_id = v_tournament_id
    AND player1_name IS NOT NULL
    AND player2_name IS NOT NULL;
  END IF;

  -- Update the tournament's player count
  UPDATE tournaments
  SET 
    registered_players_count = v_new_count,
    updated_at = now()
  WHERE id = v_tournament_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for INSERT operations
CREATE TRIGGER tournament_teams_insert_count
AFTER INSERT ON tournament_teams
FOR EACH ROW
EXECUTE FUNCTION update_tournament_player_count();

-- Create trigger for UPDATE operations
CREATE TRIGGER tournament_teams_update_count
AFTER UPDATE ON tournament_teams
FOR EACH ROW
WHEN (
  OLD.player1_name IS DISTINCT FROM NEW.player1_name OR
  OLD.player2_name IS DISTINCT FROM NEW.player2_name
)
EXECUTE FUNCTION update_tournament_player_count();

-- Create trigger for DELETE operations
CREATE TRIGGER tournament_teams_delete_count
AFTER DELETE ON tournament_teams
FOR EACH ROW
EXECUTE FUNCTION update_tournament_player_count();

-- Add comment
COMMENT ON FUNCTION update_tournament_player_count() IS 'Automatically updates tournaments.registered_players_count when tournament_teams records change';
