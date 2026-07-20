/*
  # Fix Tournament Teams User Registration

  1. Problem
    - Users cannot join tournaments because there's no INSERT policy allowing them to register
    - Only tournament creators can INSERT into tournament_teams
    - This blocks legitimate tournament participation

  2. Solution
    - Add INSERT policy for authenticated users to register themselves
    - Allow registration for public King of the Hill tournaments
    - Ensure users can only add themselves (not other players)

  3. Security
    - Users can only set themselves as player1_user_id
    - Must match auth.uid()
    - Only for public tournaments or tournaments they created
    - Only for King of the Hill format
*/

-- Allow users to register themselves for tournaments
CREATE POLICY "Users can register for King of the Hill tournaments"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is adding themselves as player1
    player1_user_id = auth.uid()
    AND player2_user_id IS NULL
    AND player2_name IS NULL
    -- Tournament exists and is either public or they're invited
    AND EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
      AND tournaments.format = 'king_of_the_hill'
      AND (
        tournaments.is_private = false
        OR tournaments.created_by = auth.uid()
      )
    )
  );
