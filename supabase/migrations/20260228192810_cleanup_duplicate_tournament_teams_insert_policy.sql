/*
  # Cleanup Duplicate Tournament Teams INSERT Policy

  ## Purpose
  Remove the old restrictive INSERT policy that only allowed tournament creators
  to manage teams. We now have a more permissive policy that allows any authenticated
  user to claim seats.

  ## Changes Made
  1. Drop the old "Tournament creators can manage tournament teams" INSERT policy
  2. Keep the new "Any user can claim tournament seats" policy

  ## Security Notes
  - Any authenticated user can now insert tournament team records
  - This enables self-registration for tournaments
*/

-- Drop the old restrictive creator-only INSERT policy
DROP POLICY IF EXISTS "Tournament creators can manage tournament teams" ON tournament_teams;