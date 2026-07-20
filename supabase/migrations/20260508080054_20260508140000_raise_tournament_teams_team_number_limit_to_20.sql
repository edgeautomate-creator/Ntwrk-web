/*
  # Raise tournament_teams team_number check constraint limit from 12 to 20

  The existing CHECK constraint on tournament_teams.team_number capped the value at 12.
  This migration drops that constraint and replaces it with one that allows up to 20,
  matching the updated expected_teams limit on the tournaments table.
*/

ALTER TABLE tournament_teams DROP CONSTRAINT IF EXISTS tournament_teams_team_number_check;

ALTER TABLE tournament_teams ADD CONSTRAINT tournament_teams_team_number_check
  CHECK (team_number >= 1 AND team_number <= 20);
