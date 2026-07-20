/*
  # Fix RLS Auth.uid() Consistency

  ## Purpose
  Standardize all RLS policies to use consistent `(SELECT auth.uid())` syntax
  to ensure proper session context evaluation.

  ## Changes Made
  
  1. **Tournaments Table**
     - Drop and recreate all policies with standardized auth.uid() syntax
     - Ensure INSERT policy checks `created_by = (SELECT auth.uid())`
     - Ensure SELECT policy properly checks user ownership and participation
     - Ensure UPDATE policy validates ownership
     - Ensure DELETE policy validates ownership
  
  2. **Tournament Participants Table**
     - Standardize user_id checks to use `(SELECT auth.uid())`
     - Ensure proper session context binding
  
  3. **Tournament Teams Table**
     - Standardize all auth checks to use consistent syntax
  
  ## Security Notes
  - All policies require authenticated users
  - Ownership checks use consistent `(SELECT auth.uid())` pattern
  - This ensures session context is properly evaluated at policy execution time
*/

-- Drop existing tournament policies
DROP POLICY IF EXISTS "Users can view tournaments they created or participate in" ON tournaments;
DROP POLICY IF EXISTS "Users can create tournaments" ON tournaments;
DROP POLICY IF EXISTS "Users can update tournaments they created" ON tournaments;
DROP POLICY IF EXISTS "Users can delete tournaments they created" ON tournaments;

-- Recreate tournament policies with consistent auth.uid() syntax
CREATE POLICY "Users can view tournaments they created or participate in"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 
      FROM tournament_participants 
      WHERE tournament_participants.tournament_id = tournaments.id 
      AND tournament_participants.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can create tournaments"
  ON tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can update tournaments they created"
  ON tournaments
  FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can delete tournaments they created"
  ON tournaments
  FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Drop existing tournament_participants policies
DROP POLICY IF EXISTS "Users can view tournament participants" ON tournament_participants;
DROP POLICY IF EXISTS "Users can join tournaments" ON tournament_participants;
DROP POLICY IF EXISTS "Tournament creators can manage participants" ON tournament_participants;

-- Recreate tournament_participants policies with consistent syntax
CREATE POLICY "Users can view tournament participants"
  ON tournament_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 
      FROM tournaments 
      WHERE tournaments.id = tournament_participants.tournament_id 
      AND tournaments.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can join tournaments"
  ON tournament_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Tournament creators can manage participants"
  ON tournament_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM tournaments 
      WHERE tournaments.id = tournament_participants.tournament_id 
      AND tournaments.created_by = (SELECT auth.uid())
    )
  );

-- Drop existing tournament_teams policies
DROP POLICY IF EXISTS "Anyone can view tournament teams" ON tournament_teams;
DROP POLICY IF EXISTS "Authenticated users can claim empty player1 slots" ON tournament_teams;
DROP POLICY IF EXISTS "Authenticated users can claim empty player2 slots" ON tournament_teams;
DROP POLICY IF EXISTS "Users can update their own player slots" ON tournament_teams;

-- Recreate tournament_teams policies with consistent syntax
CREATE POLICY "Anyone can view tournament teams"
  ON tournament_teams
  FOR SELECT
  TO authenticated
  USING (
    player1_user_id = (SELECT auth.uid()) OR
    player2_user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 
      FROM tournaments 
      WHERE tournaments.id = tournament_teams.tournament_id 
      AND tournaments.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Authenticated users can claim empty player1 slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (player1_name IS NULL OR (SELECT auth.uid()) = player1_user_id)
  WITH CHECK (
    (player1_name IS NOT NULL AND (SELECT auth.uid()) = player1_user_id) OR
    (player2_name IS NOT NULL AND (SELECT auth.uid()) = player2_user_id)
  );

CREATE POLICY "Authenticated users can claim empty player2 slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (player2_name IS NULL OR (SELECT auth.uid()) = player2_user_id)
  WITH CHECK (
    (player1_name IS NOT NULL AND (SELECT auth.uid()) = player1_user_id) OR
    (player2_name IS NOT NULL AND (SELECT auth.uid()) = player2_user_id)
  );

CREATE POLICY "Users can update their own player slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = player1_user_id OR (SELECT auth.uid()) = player2_user_id)
  WITH CHECK ((SELECT auth.uid()) = player1_user_id OR (SELECT auth.uid()) = player2_user_id);

-- Tournament creators can manage all teams in their tournaments
CREATE POLICY "Tournament creators can manage teams"
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