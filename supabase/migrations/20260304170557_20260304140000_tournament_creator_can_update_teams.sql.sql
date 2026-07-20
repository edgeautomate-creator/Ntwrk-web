/*
  # Tournament creator can update teams (remove player, edit name)

  1. Add UPDATE policy so tournament creator can update any team in their tournament.
  2. Enables: removing a player from a roster (clear slot so someone else can claim), and editing player names for non-DUPR.
*/

CREATE POLICY "Tournament creators can update teams in their tournament"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  );
