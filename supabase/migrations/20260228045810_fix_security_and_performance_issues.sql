/*
  # Fix Security and Performance Issues

  ## Summary
  This migration addresses multiple security and performance issues identified in the database audit.

  ## Changes Made

  ### 1. Add Missing Indexes for Foreign Keys
  - Add indexes for all unindexed foreign keys on `pickup_playoff_matchups` table
  - These indexes improve query performance for joins and foreign key constraint checks

  ### 2. Optimize RLS Policies
  - Fix RLS policies on `pickup_playoff_matchups` to use `(select auth.uid())` instead of `auth.uid()`
  - This prevents re-evaluation of auth functions for each row, significantly improving performance at scale

  ### 3. Remove Unused Indexes
  - Drop indexes that have never been used to reduce storage overhead and maintenance costs
  - Includes indexes on audit_logs, divisions, dupr_submissions, games, matches, organizations, 
    pair_stats, player_stats, standings, teams, tournament_teams, user_roles, pickup_matchups, 
    pickup_playoff_matchups, tournament_matches, tournaments, and pickup_sessions tables

  ### 4. Consolidate Duplicate RLS Policies
  - Remove duplicate permissive policies on `tournament_teams` table
  - Keep only the most comprehensive policy for each action to avoid confusion and potential security issues

  ## Performance Impact
  - Adding missing indexes will improve query performance for playoff matchups
  - Optimizing RLS policies will significantly improve performance at scale
  - Removing unused indexes reduces storage and maintenance overhead
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- Indexes for pickup_playoff_matchups foreign keys
CREATE INDEX IF NOT EXISTS idx_pickup_playoff_matchups_advances_to_match 
  ON pickup_playoff_matchups(advances_to_match);

CREATE INDEX IF NOT EXISTS idx_pickup_playoff_matchups_player_a_user_id 
  ON pickup_playoff_matchups(player_a_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_playoff_matchups_player_b_user_id 
  ON pickup_playoff_matchups(player_b_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_playoff_matchups_team1_player1_user_id 
  ON pickup_playoff_matchups(team1_player1_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_playoff_matchups_team1_player2_user_id 
  ON pickup_playoff_matchups(team1_player2_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_playoff_matchups_team2_player1_user_id 
  ON pickup_playoff_matchups(team2_player1_user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_playoff_matchups_team2_player2_user_id 
  ON pickup_playoff_matchups(team2_player2_user_id);

-- =====================================================
-- 2. OPTIMIZE RLS POLICIES ON PICKUP_PLAYOFF_MATCHUPS
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view playoff matchups for accessible sessions" ON pickup_playoff_matchups;
DROP POLICY IF EXISTS "Session creator can insert playoff matchups" ON pickup_playoff_matchups;
DROP POLICY IF EXISTS "Session creator or participants can update playoff matchups" ON pickup_playoff_matchups;
DROP POLICY IF EXISTS "Session creator can delete playoff matchups" ON pickup_playoff_matchups;

-- Recreate policies with optimized auth.uid() calls
CREATE POLICY "Users can view playoff matchups for accessible sessions"
  ON pickup_playoff_matchups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = pickup_playoff_matchups.session_id
      AND (
        pickup_sessions.tenant_id IN (
          SELECT organization_id FROM user_roles 
          WHERE user_id = (select auth.uid())
        )
        OR pickup_sessions.created_by = (select auth.uid())
      )
    )
  );

CREATE POLICY "Session creator can insert playoff matchups"
  ON pickup_playoff_matchups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Session creator or participants can update playoff matchups"
  ON pickup_playoff_matchups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
    OR player_a_user_id = (select auth.uid())
    OR player_b_user_id = (select auth.uid())
    OR team1_player1_user_id = (select auth.uid())
    OR team1_player2_user_id = (select auth.uid())
    OR team2_player1_user_id = (select auth.uid())
    OR team2_player2_user_id = (select auth.uid())
  );

CREATE POLICY "Session creator can delete playoff matchups"
  ON pickup_playoff_matchups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = session_id
      AND pickup_sessions.created_by = (select auth.uid())
    )
  );

-- =====================================================
-- 3. REMOVE UNUSED INDEXES
-- =====================================================

-- Audit logs indexes
DROP INDEX IF EXISTS idx_audit_logs_organization_id;
DROP INDEX IF EXISTS idx_audit_logs_user_id;

-- Division indexes
DROP INDEX IF EXISTS idx_division_players_organization_id;
DROP INDEX IF EXISTS idx_division_players_player_id;
DROP INDEX IF EXISTS idx_divisions_organization_id;

-- DUPR indexes
DROP INDEX IF EXISTS idx_dupr_submissions_match_id;
DROP INDEX IF EXISTS idx_dupr_submissions_organization_id;
DROP INDEX IF EXISTS idx_dupr_submissions_submitted_by;

-- Games indexes
DROP INDEX IF EXISTS idx_games_organization_id;
DROP INDEX IF EXISTS idx_games_winner_team_id;

-- Matches indexes
DROP INDEX IF EXISTS idx_matches_approved_by;
DROP INDEX IF EXISTS idx_matches_division_id;
DROP INDEX IF EXISTS idx_matches_team1_id;
DROP INDEX IF EXISTS idx_matches_team2_id;
DROP INDEX IF EXISTS idx_matches_winner_team_id;

-- Organizations indexes
DROP INDEX IF EXISTS idx_organizations_created_by;

-- Stats indexes
DROP INDEX IF EXISTS idx_pair_stats_organization_id;
DROP INDEX IF EXISTS idx_pair_stats_player1_id;
DROP INDEX IF EXISTS idx_pair_stats_player2_id;
DROP INDEX IF EXISTS idx_player_stats_organization_id;

-- Standings indexes
DROP INDEX IF EXISTS idx_standings_organization_id;
DROP INDEX IF EXISTS idx_standings_team_id;

-- Teams indexes
DROP INDEX IF EXISTS idx_teams_organization_id;

-- Tournament teams indexes
DROP INDEX IF EXISTS idx_tournament_teams_claimed_by_user_id;
DROP INDEX IF EXISTS idx_tournament_teams_player1_user_id;
DROP INDEX IF EXISTS idx_tournament_teams_player2_user_id;

-- User roles indexes
DROP INDEX IF EXISTS idx_user_roles_organization_id;

-- Pickup matchups indexes
DROP INDEX IF EXISTS idx_pickup_matchups_round;
DROP INDEX IF EXISTS idx_pickup_matchups_player_a_user_id;
DROP INDEX IF EXISTS idx_pickup_matchups_player_b_user_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team1_player1_user_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team1_player2_user_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team2_player1_user_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team2_player2_user_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team2_player2_id;
DROP INDEX IF EXISTS idx_pickup_matchups_player_a_id;
DROP INDEX IF EXISTS idx_pickup_matchups_player_b_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team1_player1_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team1_player2_id;
DROP INDEX IF EXISTS idx_pickup_matchups_team2_player1_id;

-- Pickup playoff matchups indexes
DROP INDEX IF EXISTS idx_playoff_matchups_bracket_round;
DROP INDEX IF EXISTS idx_playoff_matchups_status;

-- Tournament matches indexes
DROP INDEX IF EXISTS idx_tournament_matches_winner_team_id;

-- Tournaments indexes
DROP INDEX IF EXISTS idx_tournaments_champion_team_id;

-- Pickup sessions indexes
DROP INDEX IF EXISTS idx_pickup_sessions_status;

-- =====================================================
-- 4. CONSOLIDATE DUPLICATE RLS POLICIES
-- =====================================================

-- Remove duplicate INSERT policies on tournament_teams (keep the more comprehensive one)
DROP POLICY IF EXISTS "Tournament creators can manage team slots" ON tournament_teams;

-- Remove duplicate UPDATE policies on tournament_teams (keep the more comprehensive one)
DROP POLICY IF EXISTS "Users can claim and update slots" ON tournament_teams;
