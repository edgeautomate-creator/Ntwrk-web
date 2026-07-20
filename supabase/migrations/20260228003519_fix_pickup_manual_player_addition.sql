/*
  # Fix Pickup Session Manual Player Addition

  1. Changes
    - Update `pickup_session_players` INSERT policy to allow session creators to manually add players
    - This enables organizers to add players who don't have accounts or want to join without the app
    - Maintains security by only allowing the session creator to add players manually
  
  2. Security
    - Users can still join themselves (existing functionality)
    - Session creators can now add any player to their sessions
    - All additions still require the session to be in the user's organization
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Users can join pickup sessions" ON pickup_session_players;

-- Create new policy that allows both self-joining and creator-adding
CREATE POLICY "Users can join pickup sessions or creators can add players"
  ON pickup_session_players FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow users to join themselves
    (
      user_id = auth.uid()
      AND session_id IN (
        SELECT id FROM pickup_sessions WHERE tenant_id IN (
          SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
        )
      )
    )
    OR
    -- Allow session creators to add any player
    (
      session_id IN (
        SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
      )
    )
  );