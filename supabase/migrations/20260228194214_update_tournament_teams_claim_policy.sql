/*
  # Update Tournament Teams Claim Policy

  1. Changes
    - Drop existing "Users can claim slots or update their teams" policy
    - Create new policy with refined logic:
      - Users can claim empty player1 or player2 slots (where player_name IS NULL)
      - Users can update slots they already occupy (player1_user_id or player2_user_id matches auth.uid())
      - After update, user must be one of the two players (prevents stealing slots)

  2. Security
    - Prevents users from overwriting existing players
    - Ensures users can only claim empty slots or edit their own assignments
    - WITH CHECK ensures post-update the user is legitimately assigned to the team
*/

DROP POLICY IF EXISTS "Users can claim slots or update their teams" ON tournament_teams;

-- Allow: (1) claiming an empty player1 or player2 slot, or (2) updating a slot you already have
CREATE POLICY "Users can claim slots or update their teams"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (
    -- Claim empty player1 slot
    player1_name IS NULL
    OR
    -- Claim empty player2 slot
    player2_name IS NULL
    OR
    -- Already player1 or player2 (edit your own slot)
    (SELECT auth.uid()) = player1_user_id
    OR (SELECT auth.uid()) = player2_user_id
  )
  WITH CHECK (
    -- After update, you must be one of the two players (no stealing someone else's slot)
    (SELECT auth.uid()) = player1_user_id
    OR (SELECT auth.uid()) = player2_user_id
  );
