/*
  # Raise expected_teams and team_number limits to 40

  Raises the CHECK constraints on both tournaments.expected_teams and
  tournament_teams.team_number from 20 to 40, allowing tournaments
  with up to 40 teams.
*/

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_expected_teams_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_expected_teams_check
  CHECK (expected_teams >= 2 AND expected_teams <= 40);

ALTER TABLE tournament_teams DROP CONSTRAINT IF EXISTS tournament_teams_team_number_check;
ALTER TABLE tournament_teams ADD CONSTRAINT tournament_teams_team_number_check
  CHECK (team_number >= 1 AND team_number <= 40);
