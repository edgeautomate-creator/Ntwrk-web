/*
  # Add UPDATE Policy for Tournament Matches

  1. Changes
    - Add UPDATE policy for tournament_matches table
    - Allow tournament creators to update match scores and status
  
  2. Security
    - Only tournament creators can update matches
    - Policy checks creator via tournaments table relationship
*/

CREATE POLICY "Creators can update matches"
  ON tournament_matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tournaments
      WHERE tournaments.id = tournament_matches.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tournaments
      WHERE tournaments.id = tournament_matches.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );
