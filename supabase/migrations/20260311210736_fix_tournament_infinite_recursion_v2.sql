/*
  # Fix Infinite Recursion in Tournament Policies

  ## Problem
  The `is_tournament_creator` function is marked as SECURITY DEFINER and queries the tournaments table.
  When INSERT/UPDATE policies on tournament_teams call this function, it triggers recursive policy checks
  because tournaments policies may reference related tables like tournament_teams or tournament_participants.

  ## Solution
  1. Drop existing policies that use the function
  2. Drop the problematic `is_tournament_creator` function
  3. Recreate policies with direct inline subqueries
  4. Use simple joins that don't trigger recursive policy evaluation

  ## Changes
  - Drop `is_tournament_creator` function
  - Update tournament_teams INSERT policy to use inline EXISTS check
  - Update tournament_teams UPDATE policy to use inline EXISTS check
  - Policies now directly query tournaments.created_by without triggering recursion

  ## Security
  - Maintains same security model: only tournament creators can insert/update teams
  - Uses inline subqueries that don't bypass RLS
  - Authenticated users only
*/

-- Drop policies that depend on the function first
DROP POLICY IF EXISTS "Tournament creators can insert teams" ON tournament_teams;
DROP POLICY IF EXISTS "Tournament creators can update teams in their tournament" ON tournament_teams;

-- Now drop the problematic function
DROP FUNCTION IF EXISTS is_tournament_creator(uuid, uuid);

-- Recreate tournament_teams INSERT policy with inline check
CREATE POLICY "Tournament creators can insert teams"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  );

-- Recreate tournament_teams UPDATE policy for creators with inline check
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
