/*
  # Fix Infinite Recursion with RLS Bypass Function

  ## Problem
  Even after restructuring policies, recursion still occurs because:
  1. INSERT on tournaments triggers SELECT policies
  2. "Approved participants" SELECT policy queries tournament_participants
  3. tournament_participants policies query tournaments back
  4. This creates an infinite loop

  ## Solution
  Create a security definer function that bypasses RLS for the participant check.
  This function runs with elevated privileges and doesn't trigger policy checks.

  ## Changes
  - Create `is_tournament_participant_approved` function with SECURITY DEFINER
  - Update "Approved participants can view private tournaments" policy to use this function
  - Function directly queries tournament_participants without triggering RLS recursion

  ## Security
  - Function only checks if user is an approved participant
  - No data leakage - only returns boolean
  - Maintains same security model
*/

-- Create security definer function to check participation without RLS
CREATE OR REPLACE FUNCTION is_tournament_participant_approved(
  tournament_id_param uuid,
  user_id_param uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_participants
    WHERE tournament_participants.tournament_id = tournament_id_param
      AND tournament_participants.user_id = user_id_param
      AND tournament_participants.status = 'approved'
  );
$$;

-- Drop and recreate the problematic policy using the bypass function
DROP POLICY IF EXISTS "Approved participants can view private tournaments" ON tournaments;

CREATE POLICY "Approved participants can view private tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (
    is_private = true
    AND created_by != auth.uid()
    AND is_tournament_participant_approved(id, auth.uid())
  );
