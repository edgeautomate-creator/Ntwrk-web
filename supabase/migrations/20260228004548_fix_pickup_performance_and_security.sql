/*
  # Fix Pickup System Performance and Security Issues

  ## Overview
  This migration addresses critical performance and security issues in the pickup sessions system and other tables.

  ## Changes Made

  ### 1. Add Missing Indexes for Foreign Keys
  - Add indexes on `pickup_matchups` table for all user_id foreign keys
    - `player_a_user_id`
    - `player_b_user_id`
    - `team1_player1_user_id`
    - `team1_player2_user_id`
    - `team2_player1_user_id`
    - `team2_player2_user_id`

  ### 2. Optimize RLS Policies (Auth Function Initialization)
  Replace `auth.uid()` with `(select auth.uid())` in all pickup-related policies to prevent re-evaluation for each row:
  - `pickup_sessions` policies (view, create, update)
  - `pickup_session_players` policies (view, join, update)
  - `pickup_rounds` policies (view, create)
  - `pickup_matchups` policies (view, create, update)

  ### 3. Fix Tournament Security Issues
  - Remove overly permissive tournament creation policy
  - Consolidate duplicate tournament_teams policies
  - Add proper user-level authorization checks

  ## Performance Impact
  - Significantly improves query performance for pickup matchups with user lookups
  - Reduces RLS policy evaluation overhead by initializing auth functions once per query
  - Eliminates redundant index scans

  ## Security Impact
  - Ensures proper authorization checks for tournament creation
  - Consolidates permissive policies to prevent security gaps
  - Maintains data integrity while improving performance
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR PICKUP_MATCHUPS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_a_user_id 
  ON public.pickup_matchups(player_a_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_b_user_id 
  ON public.pickup_matchups(player_b_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player1_user_id 
  ON public.pickup_matchups(team1_player1_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player2_user_id 
  ON public.pickup_matchups(team1_player2_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player1_user_id 
  ON public.pickup_matchups(team2_player1_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player2_user_id 
  ON public.pickup_matchups(team2_player2_user_id);

-- =====================================================
-- 2. OPTIMIZE PICKUP_SESSIONS RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view pickup sessions in their org" ON public.pickup_sessions;
CREATE POLICY "Users can view pickup sessions in their org"
  ON public.pickup_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.organization_id = pickup_sessions.tenant_id
    )
  );

DROP POLICY IF EXISTS "Users can create pickup sessions" ON public.pickup_sessions;
CREATE POLICY "Users can create pickup sessions"
  ON public.pickup_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.organization_id = pickup_sessions.tenant_id
    )
  );

DROP POLICY IF EXISTS "Session creators can update their sessions" ON public.pickup_sessions;
CREATE POLICY "Session creators can update their sessions"
  ON public.pickup_sessions
  FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- =====================================================
-- 3. OPTIMIZE PICKUP_SESSION_PLAYERS RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view players in sessions they can view" ON public.pickup_session_players;
CREATE POLICY "Users can view players in sessions they can view"
  ON public.pickup_session_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pickup_sessions
      JOIN public.user_roles ON user_roles.organization_id = pickup_sessions.tenant_id
      WHERE pickup_sessions.id = pickup_session_players.session_id
      AND user_roles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can join pickup sessions or creators can add players" ON public.pickup_session_players;
CREATE POLICY "Users can join pickup sessions or creators can add players"
  ON public.pickup_session_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pickup_sessions
      WHERE pickup_sessions.id = pickup_session_players.session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own player status" ON public.pickup_session_players;
CREATE POLICY "Users can update their own player status"
  ON public.pickup_session_players
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pickup_sessions
      WHERE pickup_sessions.id = pickup_session_players.session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pickup_sessions
      WHERE pickup_sessions.id = pickup_session_players.session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  );

-- =====================================================
-- 4. OPTIMIZE PICKUP_ROUNDS RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view rounds in sessions they can view" ON public.pickup_rounds;
CREATE POLICY "Users can view rounds in sessions they can view"
  ON public.pickup_rounds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pickup_sessions
      JOIN public.user_roles ON user_roles.organization_id = pickup_sessions.tenant_id
      WHERE pickup_sessions.id = pickup_rounds.session_id
      AND user_roles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Session creators can create rounds" ON public.pickup_rounds;
CREATE POLICY "Session creators can create rounds"
  ON public.pickup_rounds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pickup_sessions
      WHERE pickup_sessions.id = pickup_rounds.session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  );

-- =====================================================
-- 5. OPTIMIZE PICKUP_MATCHUPS RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view matchups in sessions they can view" ON public.pickup_matchups;
CREATE POLICY "Users can view matchups in sessions they can view"
  ON public.pickup_matchups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pickup_sessions
      JOIN public.user_roles ON user_roles.organization_id = pickup_sessions.tenant_id
      WHERE pickup_sessions.id = pickup_matchups.session_id
      AND user_roles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Session creators can create matchups" ON public.pickup_matchups;
CREATE POLICY "Session creators can create matchups"
  ON public.pickup_matchups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pickup_sessions
      WHERE pickup_sessions.id = pickup_matchups.session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants and creators can update matchup scores" ON public.pickup_matchups;
CREATE POLICY "Participants and creators can update matchup scores"
  ON public.pickup_matchups
  FOR UPDATE
  TO authenticated
  USING (
    player_a_user_id = (select auth.uid())
    OR player_b_user_id = (select auth.uid())
    OR team1_player1_user_id = (select auth.uid())
    OR team1_player2_user_id = (select auth.uid())
    OR team2_player1_user_id = (select auth.uid())
    OR team2_player2_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pickup_sessions
      WHERE pickup_sessions.id = pickup_matchups.session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  )
  WITH CHECK (
    player_a_user_id = (select auth.uid())
    OR player_b_user_id = (select auth.uid())
    OR team1_player1_user_id = (select auth.uid())
    OR team1_player2_user_id = (select auth.uid())
    OR team2_player1_user_id = (select auth.uid())
    OR team2_player2_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pickup_sessions
      WHERE pickup_sessions.id = pickup_matchups.session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  );

-- =====================================================
-- 6. FIX TOURNAMENT SECURITY ISSUES
-- =====================================================

-- Drop the overly permissive tournament creation policy
DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON public.tournaments;

-- Create a proper tournament creation policy with user authorization
CREATE POLICY "Authenticated users can create tournaments"
  ON public.tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
  );

-- =====================================================
-- 7. CONSOLIDATE DUPLICATE TOURNAMENT_TEAMS POLICIES
-- =====================================================

-- Drop duplicate insert policies
DROP POLICY IF EXISTS "Tournament creators can create team slots" ON public.tournament_teams;
DROP POLICY IF EXISTS "Tournament creators can manage teams" ON public.tournament_teams;

-- Create single consolidated insert policy
CREATE POLICY "Tournament creators can manage tournament teams"
  ON public.tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
      AND tournaments.created_by = (select auth.uid())
    )
  );

-- Drop duplicate update policies
DROP POLICY IF EXISTS "Authenticated users can claim empty player1 slots" ON public.tournament_teams;
DROP POLICY IF EXISTS "Authenticated users can claim empty player2 slots" ON public.tournament_teams;
DROP POLICY IF EXISTS "Users can update their own player slots" ON public.tournament_teams;
DROP POLICY IF EXISTS "Users can update tournament teams" ON public.tournament_teams;

-- Create single consolidated update policy
CREATE POLICY "Users can claim slots or update their teams"
  ON public.tournament_teams
  FOR UPDATE
  TO authenticated
  USING (
    -- Can update if creator
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
      AND tournaments.created_by = (select auth.uid())
    )
    -- Or if user is one of the players
    OR player1_user_id = (select auth.uid())
    OR player2_user_id = (select auth.uid())
    OR claimed_by_user_id = (select auth.uid())
  )
  WITH CHECK (
    -- Can update if creator
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
      AND tournaments.created_by = (select auth.uid())
    )
    -- Or if user is one of the players
    OR player1_user_id = (select auth.uid())
    OR player2_user_id = (select auth.uid())
    OR claimed_by_user_id = (select auth.uid())
  );
