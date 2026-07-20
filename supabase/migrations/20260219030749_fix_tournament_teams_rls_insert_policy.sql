/*
  # Fix Tournament Teams RLS Insert Policy

  1. Changes
    - Add INSERT policy for tournament_teams table
    - Allow authenticated users to insert teams when creating tournaments
    - Tournament creator can create team slots for their tournament
  
  2. Security
    - Only authenticated users can insert teams
    - Policy ensures teams can only be created for valid tournaments
*/

CREATE POLICY "Tournament creators can create team slots"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );
