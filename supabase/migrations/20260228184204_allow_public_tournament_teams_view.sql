/*
  # Allow Public Access to Tournament Teams

  ## Purpose
  Update the tournament_teams SELECT policy to allow anyone (including unauthenticated users)
  to view all tournament teams. This enables public viewing of tournament rosters and 
  available slots without requiring authentication.

  ## Changes Made
  1. Drop existing "Anyone can view tournament teams" policy (which required authentication)
  2. Create new policy that uses `TO public` instead of `TO authenticated`
  3. Policy allows unrestricted SELECT access with `USING (true)`

  ## Security Notes
  - This only affects SELECT operations on tournament_teams
  - INSERT, UPDATE, and DELETE policies remain restricted to authenticated users
  - Public visibility enables easier tournament discovery and participation
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view tournament teams" ON tournament_teams;

-- Create new public policy that allows anyone to view tournament teams
CREATE POLICY "Anyone can view tournament teams"
  ON tournament_teams
  FOR SELECT
  TO public
  USING (true);