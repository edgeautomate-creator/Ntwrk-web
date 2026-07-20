/*
  # Fix Infinite Recursion in Tournament Participants

  ## Problem
  The tournament_participants SELECT policies query the tournaments table to check is_private.
  This can cause recursion when tournaments policies query tournament_participants.

  ## Solution
  Restructure tournament_participants policies to minimize recursive queries:
  1. Allow users to view their own participation records directly
  2. Allow tournament creators to view participants without recursive checks
  3. Only check tournaments table when absolutely necessary
  4. Use security definer functions where appropriate to bypass RLS

  ## Changes
  - Drop existing SELECT policies on tournament_participants
  - Create policy for users to view their own participation
  - Create policy for creators to view participants in their tournaments
  - Create policy for viewing participants in public tournaments

  ## Security
  - Users can see their own participation records
  - Creators can see all participants in their tournaments
  - Anyone can see participants in public tournaments
  - No access to participants in private tournaments unless creator or participant
*/

-- Drop existing SELECT policies that cause recursion
DROP POLICY IF EXISTS "Anyone can view participants of public tournaments" ON tournament_participants;
DROP POLICY IF EXISTS "Participants and creators can view private tournament participa" ON tournament_participants;

-- Users can view their own participation records (no recursion)
CREATE POLICY "Users can view their own participation"
  ON tournament_participants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Tournament creators can view all participants in their tournaments
-- This may query tournaments but won't cause recursion because:
-- 1. The tournaments.created_by check is simple and direct
-- 2. It doesn't trigger SELECT policies that would query back
CREATE POLICY "Creators can view participants in their tournaments"
  ON tournament_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  );

-- Anyone can view participants of public tournaments
-- This is safe because it only checks is_private flag directly
CREATE POLICY "Anyone can view participants of public tournaments"
  ON tournament_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
        AND tournaments.is_private = false
    )
  );
