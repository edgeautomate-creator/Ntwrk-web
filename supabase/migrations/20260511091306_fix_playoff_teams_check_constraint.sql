/*
  # Fix tournaments_playoff_teams_check constraint

  The old constraint limited playoff_teams to 2–6, which is too restrictive
  for pool play tournaments that can advance many more teams into playoffs.
  Widening the upper bound to 64 to accommodate large pool play formats.
*/

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_playoff_teams_check;

ALTER TABLE tournaments ADD CONSTRAINT tournaments_playoff_teams_check
  CHECK (playoff_teams >= 2 AND playoff_teams <= 64);
