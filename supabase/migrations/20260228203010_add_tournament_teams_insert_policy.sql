/*
  # Add Tournament Teams Insert Policy

  1. Changes
    - Add insert policy for tournament_teams table
    - Allows authenticated users to create new team entries

  2. Security
    - Users can only insert rows where they are assigned as player1 or player2
    - Prevents users from creating teams for other users
    - Ensures user accountability for created teams
*/

CREATE POLICY "Users can create teams they are part of"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = player1_user_id OR (SELECT auth.uid()) = player2_user_id
  );
