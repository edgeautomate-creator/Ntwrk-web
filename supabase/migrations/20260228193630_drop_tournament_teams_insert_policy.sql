/*
  # Drop tournament teams insert policy

  Removes the restrictive INSERT policy that only allowed tournament creators
  to add teams to their tournaments.
*/

DROP POLICY IF EXISTS "Tournament creators can manage tournament teams" ON tournament_teams;
