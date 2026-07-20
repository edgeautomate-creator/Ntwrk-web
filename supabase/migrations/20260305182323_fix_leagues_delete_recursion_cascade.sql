/*
  # Fix Leagues DELETE Infinite Recursion - Proper Solution with Cascade

  ## Problem
  The previous attempt still had issues because accessing ANY column in the DELETE USING clause
  triggers an implicit SELECT, which activates SELECT policies.

  ## Real Solution
  Use a security definer function that takes the league ID and internally fetches the 
  organization_id, then checks permissions. This completely bypasses the SELECT policies.

  ## Changes
  1. Drop the problematic policy first
  2. Drop the old helper function
  3. Create new function that takes league_id
  4. Create new policy using the correct function
*/

-- Drop the existing problematic policy first
DROP POLICY IF EXISTS "Org admins can delete any league" ON leagues;

-- Now we can safely drop the old function
DROP FUNCTION IF EXISTS is_org_admin_for_organization(UUID);

-- Create new security definer function that checks league deletion permission
-- Takes league_id and internally fetches organization_id to avoid RLS recursion
CREATE OR REPLACE FUNCTION can_delete_league_as_org_admin(league_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Get organization_id without triggering RLS
  SELECT organization_id INTO org_id
  FROM leagues
  WHERE id = league_id;
  
  IF org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is org admin for this organization
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role = 'org_admin'
  );
END;
$$;

-- Create new policy using the security definer function
-- Now we only pass the ID, not accessing any columns directly
CREATE POLICY "Org admins can delete any league"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    can_delete_league_as_org_admin(id)
  );

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_delete_league_as_org_admin(UUID) TO authenticated;
