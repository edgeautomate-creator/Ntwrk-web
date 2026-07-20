/*
  # Restrict Tournament Teams INSERT to Creators Only

  ## Purpose
  Only tournament creators should be able to add team slots to their tournaments.
  Regular users can claim existing slots via UPDATE, but cannot create new slots.

  ## Changes Made
  1. Drop all existing INSERT policies on tournament_teams
  2. Create a new policy that only allows tournament creators to insert team slots

  ## Security Notes
  - Only tournament creators can add team slots (INSERT)
  - Users can still claim existing slots via UPDATE policy
  - Anyone can view tournament teams via SELECT policy
*/

-- Drop all existing INSERT policies
DROP POLICY IF EXISTS "Tournament creators can manage teams" ON tournament_teams;
DROP POLICY IF EXISTS "Tournament creators can manage tournament teams" ON tournament_teams;
DROP POLICY IF EXISTS "Tournament creators can create team slots" ON tournament_teams;
DROP POLICY IF EXISTS "Any user can claim tournament seats" ON tournament_teams;

-- Only the tournament creator can add team slots to their tournament
CREATE POLICY "Tournament creators can manage tournament teams"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = (SELECT auth.uid())
    )
  );