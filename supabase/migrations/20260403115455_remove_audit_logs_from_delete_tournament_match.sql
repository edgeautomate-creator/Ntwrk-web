/*
  # Remove audit_logs Dependency from delete_tournament_match Function

  1. Changes
    - Updates `delete_tournament_match` function to remove audit_logs INSERT statement
    - Maintains all core functionality: authorization, soft delete, standings recalculation
    - Keeps DUPR deletion tracking and status management
    - Returns JSON with match data for frontend DUPR handling

  2. Security
    - Authorization check remains: only tournament creator can delete matches
    - Soft delete tracking via deleted_at and deleted_by columns
    - DUPR deletion status tracking maintained

  3. Logic Flow
    - Validates match exists and user is authorized
    - Performs soft delete (sets deleted_at, deleted_by)
    - Sets dupr_deletion_status based on DUPR match IDs
    - Recalculates tournament standings excluding deleted matches
    - Returns JSON result with DUPR deletion information

  4. Notes
    - Removed dependency on audit_logs table that may not exist
    - All other functionality unchanged from original implementation
*/

-- Update the delete_tournament_match function without audit_logs
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

-- Update function comment to reflect audit_logs removal
COMMENT ON FUNCTION delete_tournament_match IS
  'Soft deletes a tournament match. Only the tournament creator can delete matches. Returns JSON with match data for DUPR deletion handling.';