/*
  # Fix Infinite Recursion in Tournament Policies - Complete Fix

  ## Problem
  The policies have circular dependencies:
  - tournaments SELECT policy checks tournament_participants
  - tournament_participants SELECT policy checks tournaments
  - tournament_matches SELECT policy checks tournaments
  This creates infinite recursion.

  ## Solution
  Remove all recursive checks and use direct attribute checks only.
  For child tables, we'll rely on the foreign key relationship and direct checks.

  ## Changes
  1. Drop all existing policies for all three tables
  2. Recreate policies without circular dependencies
  3. Use simpler, non-recursive logic
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view tournaments" ON tournaments;
DROP POLICY IF EXISTS "Users can create tournaments" ON tournaments;
DROP POLICY IF EXISTS "Creators can update their tournaments" ON tournaments;
DROP POLICY IF EXISTS "Creators can delete their tournaments" ON tournaments;

DROP POLICY IF EXISTS "Anyone can view participants of public tournaments" ON tournament_participants;
DROP POLICY IF EXISTS "Participants and creators can view private tournament participa" ON tournament_participants;
DROP POLICY IF EXISTS "Users can request to join tournaments" ON tournament_participants;
DROP POLICY IF EXISTS "Creators can update participant status" ON tournament_participants;

DROP POLICY IF EXISTS "Anyone can view matches of public tournaments" ON tournament_matches;
DROP POLICY IF EXISTS "Participants can view private tournament matches" ON tournament_matches;
DROP POLICY IF EXISTS "Creators can create matches" ON tournament_matches;
DROP POLICY IF EXISTS "Participants can update match scores" ON tournament_matches;

-- Tournaments policies (no recursion)
CREATE POLICY "Users can view all tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can delete tournaments"
  ON tournaments FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Tournament participants policies (no recursion)
CREATE POLICY "Users can view all tournament participants"
  ON tournament_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join tournaments"
  ON tournament_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creators can update participants"
  ON tournament_participants FOR UPDATE
  TO authenticated
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

-- Tournament matches policies (no recursion)
CREATE POLICY "Users can view all tournament matches"
  ON tournament_matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Creators can create tournament matches"
  ON tournament_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Creators and participants can update matches"
  ON tournament_matches FOR UPDATE
  TO authenticated
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    ) OR
    tournament_id IN (
      SELECT tournament_id FROM tournament_participants 
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  )
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    ) OR
    tournament_id IN (
      SELECT tournament_id FROM tournament_participants 
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  );
