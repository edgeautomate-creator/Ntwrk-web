/*
  # Fix Tournament Matches Foreign Keys

  ## Changes
  - Drop old foreign key constraints that reference tournament_participants
  - Add new foreign key constraints that reference tournament_teams
  - This aligns the matches table with the current team-based system

  ## Important Notes
  - Matches should reference tournament_teams, not tournament_participants
  - This fixes the error when creating match schedules
*/

ALTER TABLE tournament_matches
  DROP CONSTRAINT IF EXISTS tournament_matches_team1_id_fkey,
  DROP CONSTRAINT IF EXISTS tournament_matches_team2_id_fkey,
  DROP CONSTRAINT IF EXISTS tournament_matches_winner_id_fkey;

ALTER TABLE tournament_matches
  ADD CONSTRAINT tournament_matches_team1_id_fkey
    FOREIGN KEY (team1_id) REFERENCES tournament_teams(id) ON DELETE CASCADE;

ALTER TABLE tournament_matches
  ADD CONSTRAINT tournament_matches_team2_id_fkey
    FOREIGN KEY (team2_id) REFERENCES tournament_teams(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'winner_id'
  ) THEN
    ALTER TABLE tournament_matches
      DROP CONSTRAINT IF EXISTS tournament_matches_winner_id_fkey;
  END IF;
END $$;
