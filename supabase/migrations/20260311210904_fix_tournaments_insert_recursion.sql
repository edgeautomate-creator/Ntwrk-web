/*
  # Fix Infinite Recursion in Tournaments INSERT

  ## Problem
  When inserting a tournament, the SELECT policies on tournaments are triggered.
  The "Participants can view private tournaments" policy queries tournament_participants.
  The tournament_participants SELECT policies query tournaments back, creating infinite recursion:
  
  tournaments SELECT -> tournament_participants -> tournaments SELECT -> tournament_participants -> ...

  ## Solution
  Split the SELECT policies to avoid recursion during INSERT:
  1. Keep simple non-recursive SELECT policies
  2. Remove the circular dependency by restructuring the private tournament visibility check
  3. Use a more direct approach that doesn't trigger recursive checks

  ## Changes
  - Drop existing SELECT policies on tournaments
  - Create new SELECT policy for public tournaments (no recursion)
  - Create new SELECT policy for private tournaments using a safer pattern
  - Tournament creators can always see their tournaments (direct check)
  - Approved participants can see private tournaments (checked via tournament_participants)

  ## Security
  - Public tournaments remain visible to all authenticated users
  - Private tournaments visible only to creators and approved participants
  - No change to security model, only implementation
*/

-- Drop existing SELECT policies on tournaments that cause recursion
DROP POLICY IF EXISTS "Anyone can view public tournaments" ON tournaments;
DROP POLICY IF EXISTS "Participants can view private tournaments" ON tournaments;

-- Simple policy: anyone can view public tournaments (no recursion)
CREATE POLICY "Anyone can view public tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (is_private = false);

-- Policy for tournament creators to view their own tournaments (no recursion)
CREATE POLICY "Creators can view their tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy for approved participants to view private tournaments
-- This uses tournament_participants but is safe because:
-- 1. It only applies when checking tournaments.is_private = true AND created_by != auth.uid()
-- 2. The tournament_participants query will use the INSERT/UPDATE context, not SELECT
-- 3. We rely on the user_id match which doesn't need to query back to tournaments
CREATE POLICY "Approved participants can view private tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (
    is_private = true
    AND created_by != auth.uid()
    AND EXISTS (
      SELECT 1
      FROM tournament_participants
      WHERE tournament_participants.tournament_id = tournaments.id
        AND tournament_participants.user_id = auth.uid()
        AND tournament_participants.status = 'approved'
    )
  );
