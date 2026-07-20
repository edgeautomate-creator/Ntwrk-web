/*
  # Fix Infinite Recursion in All League Policies

  1. Problem
    - Multiple policies reference `leagues.organization_id` 
    - When DELETE policy executes, it triggers SELECT policies
    - SELECT policies access `organization_id`, causing infinite recursion
  
  2. Solution
    - Create security definer functions for all organization checks
    - These functions bypass RLS to read organization_id
    - Update all policies to use these functions
  
  3. Changes
    - Drop all existing league policies
    - Create helper functions with RLS bypass
    - Recreate policies using helper functions
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Org admins can delete any league" ON leagues;
DROP POLICY IF EXISTS "League creator can delete leagues without scores" ON leagues;
DROP POLICY IF EXISTS "Org admins and league directors can update leagues" ON leagues;
DROP POLICY IF EXISTS "Org admins can view all org leagues" ON leagues;
DROP POLICY IF EXISTS "Users can view leagues in their orgs" ON leagues;
DROP POLICY IF EXISTS "Org members can create leagues" ON leagues;

-- Drop existing function
DROP FUNCTION IF EXISTS can_delete_league_as_org_admin(UUID);

-- Create helper function to check if user can view league (bypasses RLS)
CREATE OR REPLACE FUNCTION can_view_league(league_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  SET LOCAL row_security = OFF;
  
  SELECT organization_id INTO org_id
  FROM leagues
  WHERE id = league_id;
  
  IF org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = org_id
  );
END;
$$;

-- Create helper function to check if user is org admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_league_org_admin(league_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  SET LOCAL row_security = OFF;
  
  SELECT organization_id INTO org_id
  FROM leagues
  WHERE id = league_id;
  
  IF org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role = 'org_admin'
  );
END;
$$;

-- Create helper function to check if user can manage league (bypasses RLS)
CREATE OR REPLACE FUNCTION can_manage_league(league_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  SET LOCAL row_security = OFF;
  
  SELECT organization_id INTO org_id
  FROM leagues
  WHERE id = league_id;
  
  IF org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role IN ('org_admin', 'league_director')
  );
END;
$$;

-- Create helper function to check org membership for INSERT (bypasses RLS)
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = org_id
  );
END;
$$;

-- Recreate SELECT policies
CREATE POLICY "Users can view leagues in their orgs"
  ON leagues
  FOR SELECT
  TO authenticated
  USING (can_view_league(id));

CREATE POLICY "Org admins can view all org leagues"
  ON leagues
  FOR SELECT
  TO authenticated
  USING (is_league_org_admin(id));

-- Recreate INSERT policy
CREATE POLICY "Org members can create leagues"
  ON leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(organization_id));

-- Recreate UPDATE policy
CREATE POLICY "Org admins and league directors can update leagues"
  ON leagues
  FOR UPDATE
  TO authenticated
  USING (can_manage_league(id))
  WITH CHECK (can_manage_league(id));

-- Recreate DELETE policies
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

CREATE POLICY "Org admins can delete any league"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (is_league_org_admin(id));
