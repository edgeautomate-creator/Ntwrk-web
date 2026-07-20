/*
  # Enforce DUPR Requirement for Round Robin Tournaments

  1. Purpose
    - Prevents manual player additions (players without DUPR IDs) to DUPR-required round robin tournaments
    - Ensures data integrity for DUPR sync operations
    - Adds database-level validation that complements frontend checks

  2. Changes
    - Creates a validation function to check DUPR requirements
    - Adds a trigger on tournament_teams table to enforce DUPR validation before insert
    - Only applies to round robin individual format tournaments

  3. Validation Rules
    - If tournament has is_dupr_required = true AND format = 'round_robin_individual'
    - Then player1_dupr_id must NOT be null
    - Allows manual players (null dupr_id) for non-DUPR tournaments
    - Allows all players for other tournament formats

  4. Security
    - Trigger runs with SECURITY DEFINER to bypass RLS
    - Validation is applied consistently regardless of user permissions
*/

-- Create validation function
CREATE OR REPLACE FUNCTION validate_dupr_requirement_for_round_robin()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_dupr_required boolean;
  v_tournament_format text;
BEGIN
  -- Get tournament settings
  SELECT is_dupr_required, format
  INTO v_is_dupr_required, v_tournament_format
  FROM tournaments
  WHERE id = NEW.tournament_id;

  -- If tournament requires DUPR and is round robin individual format
  IF v_is_dupr_required AND v_tournament_format = 'round_robin_individual' THEN
    -- Check if player1_dupr_id is null (manual player without DUPR)
    IF NEW.player1_dupr_id IS NULL THEN
      RAISE EXCEPTION 'Cannot add players without DUPR IDs to DUPR-required round robin tournaments. Players must have linked DUPR accounts.'
        USING HINT = 'Only users with verified DUPR accounts can join this tournament.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to validate before insert
DROP TRIGGER IF EXISTS enforce_dupr_requirement_trigger ON tournament_teams;
CREATE TRIGGER enforce_dupr_requirement_trigger
  BEFORE INSERT ON tournament_teams
  FOR EACH ROW
  EXECUTE FUNCTION validate_dupr_requirement_for_round_robin();

-- Add comment for documentation
COMMENT ON FUNCTION validate_dupr_requirement_for_round_robin() IS
  'Validates that players in DUPR-required round robin tournaments have valid DUPR IDs. Prevents manual player additions without DUPR accounts.';