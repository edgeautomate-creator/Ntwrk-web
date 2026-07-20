/*
  # Delete bad schedule for tournament 7b777420-0d94-4e1b-9047-e09c10cbc1bf

  The round-robin algorithm had a bug that caused teams to appear twice in the
  same round. This removes all non-playoff matches for that tournament so the
  organiser can regenerate a correct schedule from the UI.
*/
DELETE FROM tournament_matches
WHERE tournament_id = '7b777420-0d94-4e1b-9047-e09c10cbc1bf'
  AND is_playoff_match = false;
