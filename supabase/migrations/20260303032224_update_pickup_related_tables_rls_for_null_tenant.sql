/*
  # Update RLS Policies for Pickup Related Tables

  ## Overview
  Update RLS policies for pickup_session_players, pickup_rounds, and pickup_matchups
  to handle sessions with null tenant_id (no organization).

  ## Changes Made

  1. **pickup_session_players Policies**
     - Update SELECT policy to check for session visibility (creator, null tenant, or org member)
     - Update INSERT policy to allow joining sessions based on new visibility rules
     - Update UPDATE policy to maintain existing behavior

  2. **pickup_rounds Policies**
     - Update SELECT policy to check for session visibility
     - Update INSERT policy to maintain creator-only access

  3. **pickup_matchups Policies**
     - Update SELECT policy to check for session visibility
     - Update INSERT policy to maintain creator-only access
     - Update UPDATE policy to maintain participant and creator access

  ## Security Notes
  - Public sessions (tenant_id IS NULL) are viewable and joinable by all authenticated users
  - Organization-scoped sessions remain private to organization members
  - Only session creators can create rounds and matchups
  - Participants can update their match scores
*/

-- ==========================================
-- Update pickup_session_players Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view players in sessions they can view" ON pickup_session_players;
CREATE POLICY "Users can view players in sessions they can view"
  ON pickup_session_players FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions
      WHERE created_by = auth.uid()
        OR tenant_id IS NULL
        OR tenant_id IN (
          SELECT organization_id 
          FROM user_roles 
          WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can join pickup sessions or creators can add players" ON pickup_session_players;
CREATE POLICY "Users can join pickup sessions or creators can add players"
  ON pickup_session_players FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM pickup_sessions
      WHERE created_by = auth.uid()
        OR tenant_id IS NULL
        OR tenant_id IN (
          SELECT organization_id 
          FROM user_roles 
          WHERE user_id = auth.uid()
        )
    )
    AND (
      session_id IN (SELECT id FROM pickup_sessions WHERE created_by = auth.uid())
      OR user_id = auth.uid()
      OR user_id IS NULL
    )
  );

-- ==========================================
-- Update pickup_rounds Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view rounds in sessions they can view" ON pickup_rounds;
CREATE POLICY "Users can view rounds in sessions they can view"
  ON pickup_rounds FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions
      WHERE created_by = auth.uid()
        OR tenant_id IS NULL
        OR tenant_id IN (
          SELECT organization_id 
          FROM user_roles 
          WHERE user_id = auth.uid()
        )
    )
  );

-- ==========================================
-- Update pickup_matchups Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view matchups in sessions they can view" ON pickup_matchups;
CREATE POLICY "Users can view matchups in sessions they can view"
  ON pickup_matchups FOR SELECT
  TO authenticated
  USING (
    round_id IN (
      SELECT id FROM pickup_rounds
      WHERE session_id IN (
        SELECT id FROM pickup_sessions
        WHERE created_by = auth.uid()
          OR tenant_id IS NULL
          OR tenant_id IN (
            SELECT organization_id 
            FROM user_roles 
            WHERE user_id = auth.uid()
          )
      )
    )
  );