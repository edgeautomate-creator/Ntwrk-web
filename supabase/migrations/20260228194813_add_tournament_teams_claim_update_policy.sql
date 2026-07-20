/*
  # Add Tournament Teams Claim/Update Policy

  1. Changes
    - Add update policy for tournament_teams table
    - Allows users to claim empty slots (when player names are NULL)
    - Allows users to update their own team entries

  2. Security
    - USING clause: Users can update if slot is empty OR they are already assigned to the team
    - WITH CHECK clause: After update, the user must be assigned as player1 or player2
    - Prevents users from updating other people's teams
*/

CREATE POLICY "Users can claim slots or update their teams"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (
    player1_name IS NULL
    OR player2_name IS NULL
    OR (SELECT auth.uid()) = player1_user_id
    OR (SELECT auth.uid()) = player2_user_id
  )
  WITH CHECK (
    (SELECT auth.uid()) = player1_user_id OR (SELECT auth.uid()) = player2_user_id
  );
