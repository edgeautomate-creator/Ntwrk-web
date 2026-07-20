/*
  # Update Tournament Teams Insert Policy

  1. Changes
    - Drop existing insert policy that allowed players to create teams
    - Add new policy restricting team creation to tournament creators only

  2. Security
    - Only tournament creators can insert team slots for their tournaments
    - Prevents unauthorized users from creating team entries
    - Ensures proper tournament management by creators
*/

-- Drop the policy that's blocking you
DROP POLICY IF EXISTS "Users can create teams they are part of" ON tournament_teams;

-- Only the tournament creator can create (insert) team rows for their tournament
CREATE POLICY "Tournament creators can create team slots"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = (SELECT auth.uid())
    )
  );
