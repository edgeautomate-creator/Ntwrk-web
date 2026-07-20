/*
  # Rollback League Recursion Fix Migrations

  1. Purpose
    - Rolls back all migrations related to fixing league infinite recursion
    - Removes helper functions created in the fix attempts
    - Restores original policies before the recursion issues
  
  2. Migrations Being Rolled Back
    - 20260305181658_fix_leagues_infinite_recursion_delete.sql
    - 20260305182303_fix_leagues_delete_infinite_recursion.sql
    - 20260305182323_fix_leagues_delete_recursion_cascade.sql
    - 20260305183142_fix_leagues_delete_recursion_with_rls_bypass.sql
    - 20260305183414_fix_leagues_recursion_all_policies.sql
  
  3. Changes
    - Drop all helper functions created in fix attempts
    - Drop all policies created/modified in fix attempts
    - Restore original policy structure
*/

-- Drop all policies on leagues table
DROP POLICY IF EXISTS "Org admins can delete any league" ON leagues;
DROP POLICY IF EXISTS "League creator can delete leagues without scores" ON leagues;
DROP POLICY IF EXISTS "Org admins and league directors can update leagues" ON leagues;
DROP POLICY IF EXISTS "Org admins can view all org leagues" ON leagues;
DROP POLICY IF EXISTS "Users can view leagues in their orgs" ON leagues;
DROP POLICY IF EXISTS "Org members can create leagues" ON leagues;

-- Drop all helper functions created in the fix attempts
DROP FUNCTION IF EXISTS can_view_league(UUID);
DROP FUNCTION IF EXISTS is_league_org_admin(UUID);
DROP FUNCTION IF EXISTS can_manage_league(UUID);
DROP FUNCTION IF EXISTS is_org_member(UUID);
DROP FUNCTION IF EXISTS can_delete_league_as_org_admin(UUID);
DROP FUNCTION IF EXISTS is_org_admin_for_organization(UUID);

-- Restore original policies (from migration 20260305180723_guard_deletion_by_scores.sql)

-- SELECT policies - allow viewing leagues for org members
CREATE POLICY "Users can view leagues in their orgs"
  ON leagues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
    )
  );

-- INSERT policy - allow org members to create leagues
CREATE POLICY "Org members can create leagues"
  ON leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
    )
  );

-- UPDATE policy - allow org admins and league directors to update
CREATE POLICY "Org admins and league directors can update leagues"
  ON leagues
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  );

-- DELETE policy - creators can delete if no scores recorded
CREATE POLICY "League creator can delete leagues without scores"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM team_matchups tm
      JOIN league_weeks lw ON lw.id = tm.league_week_id
      JOIN seasons s ON s.id = lw.season_id
      WHERE s.league_id = leagues.id
        AND (tm.finalized = true OR tm.home_matchup_wins > 0 OR tm.away_matchup_wins > 0)
    )
  );

-- DELETE policy - org admins can delete any league
CREATE POLICY "Org admins can delete leagues"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
        AND user_roles.role = 'org_admin'
    )
  );
