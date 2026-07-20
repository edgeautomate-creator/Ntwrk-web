/*
  # Raise expected_teams check constraint limit from 12 to 20

  The existing CHECK constraint on tournaments.expected_teams capped the value at 12.
  This migration drops that constraint and replaces it with one that allows up to 20,
  matching the updated dropdown in the tournament creation form.
*/

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_expected_teams_check;

ALTER TABLE tournaments ADD CONSTRAINT tournaments_expected_teams_check
  CHECK (expected_teams >= 2 AND expected_teams <= 20);
