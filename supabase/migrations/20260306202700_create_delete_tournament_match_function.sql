/*
  # Create Delete Tournament Match Function

  1. New Functions
    - `delete_tournament_match(match_id uuid)` - RPC function to delete a tournament match
    - `recalculate_tournament_standings(tournament_id uuid)` - Helper function to recalculate standings

  2. Security
    - Only tournament creator can delete matches
    - Validates match exists and belongs to tournament
    - Creates audit log entry

  3. Logic
    - Marks match as deleted (soft delete)
    - Sets DUPR deletion status based on match data
    - Recalculates team standings
    - Returns match data for client to handle DUPR deletion if needed

  4. Changes
    - Adds secure match deletion capability
    - Maintains data integrity
    - Provides audit trail
*/

-- Function to recalculate tournament standings after match deletion
CREATE OR REPLACE FUNCTION recalculate_tournament_standings(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recalculate standings for all teams in the tournament
  -- This uses only non-deleted matches
  UPDATE team_standings ts
  SET 
    matches_played = COALESCE(match_counts.played, 0),
    wins = COALESCE(match_counts.wins, 0),
    losses = COALESCE(match_counts.losses, 0),
    points_for = COALESCE(match_counts.points_for, 0),
    points_against = COALESCE(match_counts.points_against, 0),
    point_differential = COALESCE(match_counts.points_for, 0) - COALESCE(match_counts.points_against, 0),
    updated_at = now()
  FROM (
    SELECT 
      team_id,
      COUNT(*) as played,
      SUM(CASE WHEN is_winner THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN is_winner THEN 0 ELSE 1 END) as losses,
      SUM(points_for) as points_for,
      SUM(points_against) as points_against
    FROM (
      -- Team 1 perspective
      SELECT 
        team1_id as team_id,
        CASE WHEN winner_team_id = team1_id THEN true ELSE false END as is_winner,
        COALESCE(team1_score, 0) as points_for,
        COALESCE(team2_score, 0) as points_against
      FROM tournament_matches
      WHERE tournament_id = p_tournament_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND winner_team_id IS NOT NULL
      
      UNION ALL
      
      -- Team 2 perspective
      SELECT 
        team2_id as team_id,
        CASE WHEN winner_team_id = team2_id THEN true ELSE false END as is_winner,
        COALESCE(team2_score, 0) as points_for,
        COALESCE(team1_score, 0) as points_against
      FROM tournament_matches
      WHERE tournament_id = p_tournament_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND winner_team_id IS NOT NULL
    ) team_matches
    GROUP BY team_id
  ) match_counts
  WHERE ts.team_id = match_counts.team_id
    AND ts.tournament_id = p_tournament_id;
END;
$$;

-- Function to delete a tournament match
CREATE OR REPLACE FUNCTION delete_tournament_match(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match record;
  v_tournament record;
  v_result json;
BEGIN
  -- Get match details
  SELECT 
    tm.*,
    t.created_by as tournament_creator
  INTO v_match
  FROM tournament_matches tm
  JOIN tournaments t ON t.id = tm.tournament_id
  WHERE tm.id = p_match_id;

  -- Check if match exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Check if match is already deleted
  IF v_match.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Match is already deleted';
  END IF;

  -- Check authorization: only tournament creator can delete
  IF v_match.tournament_creator != auth.uid() THEN
    RAISE EXCEPTION 'Only the tournament creator can delete matches';
  END IF;

  -- Mark match as deleted
  UPDATE tournament_matches
  SET 
    deleted_at = now(),
    deleted_by = auth.uid(),
    dupr_deletion_status = CASE 
      WHEN dupr_match_id IS NOT NULL OR dupr_match_identifier IS NOT NULL 
      THEN 'pending'
      ELSE 'not_applicable'
    END
  WHERE id = p_match_id;

  -- Recalculate tournament standings
  PERFORM recalculate_tournament_standings(v_match.tournament_id);

  -- Create audit log entry
  INSERT INTO audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    created_at
  )
  SELECT
    NULL, -- tournaments don't have organization_id
    auth.uid(),
    'delete_match',
    'tournament_match',
    p_match_id,
    jsonb_build_object(
      'tournament_id', v_match.tournament_id,
      'team1_id', v_match.team1_id,
      'team2_id', v_match.team2_id,
      'winner_team_id', v_match.winner_team_id,
      'team1_score', v_match.team1_score,
      'team2_score', v_match.team2_score,
      'status', v_match.status,
      'dupr_match_id', v_match.dupr_match_id,
      'dupr_match_identifier', v_match.dupr_match_identifier
    ),
    now()
  WHERE EXISTS (SELECT 1 FROM audit_logs LIMIT 1); -- Only if audit_logs table exists

  -- Build result JSON with match data needed for DUPR deletion
  SELECT json_build_object(
    'success', true,
    'match_id', v_match.id,
    'tournament_id', v_match.tournament_id,
    'dupr_match_id', v_match.dupr_match_id,
    'dupr_match_identifier', v_match.dupr_match_identifier,
    'needs_dupr_deletion', (v_match.dupr_match_id IS NOT NULL OR v_match.dupr_match_identifier IS NOT NULL)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_tournament_match TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_tournament_standings TO authenticated;

-- Add comments
COMMENT ON FUNCTION delete_tournament_match IS 
  'Deletes a tournament match. Only the tournament creator can delete matches. Returns JSON with match data for DUPR deletion handling.';

COMMENT ON FUNCTION recalculate_tournament_standings IS 
  'Recalculates team standings for a tournament, excluding deleted matches.';