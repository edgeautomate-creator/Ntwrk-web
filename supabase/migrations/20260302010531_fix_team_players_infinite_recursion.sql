/*
  # Fix Team Players Infinite Recursion
  
  1. Problem
    - The "Captains can manage team roster" policy creates infinite recursion
    - Policy checks: team_id IN (SELECT team_id FROM team_players WHERE ...)
    - This queries team_players within a policy applied to team_players
    - Creates infinite recursion similar to tournaments/tournament_participants issue
  
  2. Solution
    - Drop the recursive "Captains can manage team roster" policy
    - Create separate non-recursive policies for each operation (SELECT, INSERT, UPDATE, DELETE)
    - Use a security definer function to check captain status without recursion
    - This matches the pattern used in other RLS fixes in the codebase
  
  3. Changes
    - Drop "Captains can manage team roster" policy
    - Create is_team_captain() security definer function
    - Add separate captain policies for each operation
    - Policies use the function instead of subqueries to avoid recursion
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Captains can manage team roster" ON team_players;

-- Create a security definer function to check captain status
-- This function runs with elevated privileges to avoid RLS recursion
CREATE OR REPLACE FUNCTION is_team_captain(check_team_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_players
    WHERE team_id = check_team_id 
      AND user_id = check_user_id 
      AND is_captain = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_team_captain(uuid, uuid) TO authenticated;

-- Policy: Team captains can view their team roster
CREATE POLICY "Captains can view team roster"
  ON team_players
  FOR SELECT
  TO authenticated
  USING (
    is_team_captain(team_id, auth.uid())
  );

-- Policy: Team captains can add players to their team
CREATE POLICY "Captains can add players to team"
  ON team_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_team_captain(team_id, auth.uid())
  );

-- Policy: Team captains can update team roster
CREATE POLICY "Captains can update team roster"
  ON team_players
  FOR UPDATE
  TO authenticated
  USING (
    is_team_captain(team_id, auth.uid())
  )
  WITH CHECK (
    is_team_captain(team_id, auth.uid())
  );

-- Policy: Team captains can remove players from their team
CREATE POLICY "Captains can remove players from team"
  ON team_players
  FOR DELETE
  TO authenticated
  USING (
    is_team_captain(team_id, auth.uid())
  );
