/*
  # Fix Infinite Recursion in Tournament Participants RLS

  1. Problem
    - The SELECT policy on tournament_participants causes infinite recursion
    - It references tournament_participants within its own policy check
    - This happens when checking if a user is a participant to determine visibility

  2. Solution
    - Remove the self-referencing check from the policy
    - Use tournament_teams table to check user participation instead
    - Simplify the policy to avoid recursion

  3. New Logic
    - Users can view participants if:
      - Tournament is public, OR
      - User is the tournament creator, OR
      - User has claimed a team in the tournament (via tournament_teams)
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view tournament participants" ON tournament_participants;

-- Create a new policy without self-reference
CREATE POLICY "Users can view tournament participants"
  ON tournament_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND (
        -- Tournament is public
        tournaments.is_private = false
        -- User is the creator
        OR tournaments.created_by = auth.uid()
        -- User has claimed a team in this tournament
        OR EXISTS (
          SELECT 1 FROM tournament_teams
          WHERE tournament_teams.tournament_id = tournaments.id
          AND tournament_teams.claimed_by_user_id = auth.uid()
        )
      )
    )
  );

COMMENT ON POLICY "Users can view tournament participants" ON tournament_participants IS 'Allows users to view participants without infinite recursion by checking tournament_teams instead of tournament_participants';
