/*
  # Fix Tournament Teams Registration Policy

  1. Changes
    - Drop the incorrect "Users can register for King of the Hill tournaments" policy
    - Create a corrected policy that checks for 'round_robin_individual' format instead of 'king_of_the_hill'
    - This allows authenticated users to register for round_robin_individual tournaments created by others

  2. Security
    - Users can only register themselves (player1_user_id must be auth.uid())
    - Only applies to single-player registrations (player2_user_id and player2_name must be NULL)
    - Only works for round_robin_individual format tournaments
    - Respects tournament privacy settings (public tournaments or user is the creator)
*/

-- Drop the old policy with incorrect format check
DROP POLICY IF EXISTS "Users can register for King of the Hill tournaments" ON tournament_teams;

-- Create the corrected policy
CREATE POLICY "Users can register for round robin individual tournaments"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    player1_user_id = auth.uid() 
    AND player2_user_id IS NULL 
    AND player2_name IS NULL 
    AND EXISTS (
      SELECT 1
      FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.format = 'round_robin_individual'
        AND (tournaments.is_private = false OR tournaments.created_by = auth.uid())
    )
  );