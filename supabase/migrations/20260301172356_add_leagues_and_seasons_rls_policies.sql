/*
  # Add RLS Policies for Leagues and Seasons Tables

  ## Changes
  This migration adds INSERT, UPDATE, and DELETE policies for the `leagues` and `seasons` tables
  to allow authenticated users to create and manage leagues and seasons in their organizations.

  ## Tables Modified
  - `leagues` - Add INSERT, UPDATE, DELETE policies
  - `seasons` - Add INSERT, UPDATE, DELETE policies

  ## Policies Added

  ### Leagues Table
  1. **INSERT Policy**: "Org members can create leagues"
     - Allows authenticated users who belong to an organization to create leagues
     - Verifies user membership through `user_roles` table
  
  2. **UPDATE Policy**: "Org admins and league directors can update leagues"
     - Allows org_admin and league_director roles to modify leagues
     - Verifies user has appropriate role in the organization
  
  3. **DELETE Policy**: "Org admins can delete leagues"
     - Allows org_admin role to remove leagues
     - Verifies user has admin role in the organization

  ### Seasons Table
  1. **INSERT Policy**: "Org members can create seasons"
     - Allows authenticated users who belong to an organization to create seasons
     - Verifies user membership through `user_roles` table
  
  2. **UPDATE Policy**: "Org admins and league directors can update seasons"
     - Allows org_admin and league_director roles to modify seasons
     - Verifies user has appropriate role in the organization
  
  3. **DELETE Policy**: "Org admins can delete seasons"
     - Allows org_admin role to remove seasons
     - Verifies user has admin role in the organization

  ## Security Notes
  - All policies require authentication via `auth.uid()`
  - All policies verify organization membership through `user_roles` table
  - UPDATE and DELETE policies have additional role-based restrictions
  - Policies align with existing `divisions` table security patterns
*/

-- ============================================================================
-- LEAGUES TABLE POLICIES
-- ============================================================================

-- INSERT: Allow org members to create leagues in their organizations
CREATE POLICY "Org members can create leagues"
  ON leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
    )
  );

-- UPDATE: Allow org admins and league directors to update leagues
CREATE POLICY "Org admins and league directors can update leagues"
  ON leagues
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  );

-- DELETE: Allow org admins to delete leagues
CREATE POLICY "Org admins can delete leagues"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = leagues.organization_id
        AND user_roles.role = 'org_admin'
    )
  );

-- ============================================================================
-- SEASONS TABLE POLICIES
-- ============================================================================

-- INSERT: Allow org members to create seasons in their organizations
CREATE POLICY "Org members can create seasons"
  ON seasons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = seasons.organization_id
    )
  );

-- UPDATE: Allow org admins and league directors to update seasons
CREATE POLICY "Org admins and league directors can update seasons"
  ON seasons
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = seasons.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = seasons.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  );

-- DELETE: Allow org admins to delete seasons
CREATE POLICY "Org admins can delete seasons"
  ON seasons
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = seasons.organization_id
        AND user_roles.role = 'org_admin'
    )
  );