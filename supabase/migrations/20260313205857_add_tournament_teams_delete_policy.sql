/*
  # Add Delete Policy for Tournament Teams

  1. Changes
    - Add DELETE policy to tournament_teams table
    - Allows tournament creators to delete team registrations
    - Checks if the user is the creator of the associated tournament

  2. Security
    - Only tournament creators can delete teams from their tournaments
    - Policy prevents unauthorized deletion of team registrations
*/

-- Drop existing delete policy if any
DROP POLICY IF EXISTS "Tournament creators can delete teams" ON tournament_teams;

-- Create delete policy for tournament creators
CREATE POLICY "Tournament creators can delete teams"
  ON tournament_teams
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );
