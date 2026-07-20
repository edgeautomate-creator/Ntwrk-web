/*
  # Fix Leagues DELETE Infinite Recursion

  ## Problem
  DELETE policies on leagues table cause infinite recursion because:
  - DELETE policy checks `leagues.organization_id`
  - PostgreSQL performs implicit SELECT to read the row being deleted
  - This triggers SELECT policies which also check `leagues.organization_id`
  - Creates circular dependency: DELETE → SELECT → DELETE → infinite loop

  ## Solution
  1. Create security definer function to check org admin status without triggering RLS
  2. Replace the org admin DELETE policy with one that uses this function
  3. The function operates outside RLS context, breaking the circular dependency

  ## Changes
  1. New Function
     - `is_org_admin_for_organization(org_id UUID)` - checks if current user is org admin
     - Runs as SECURITY DEFINER to bypass RLS on user_roles table
  
  2. Updated Policies
     - Drop existing "Org admins can delete any league" policy
     - Create new policy that uses the security definer function
     - Keep "League creator can delete leagues without scores" policy unchanged
*/

-- Create security definer function to check org admin status
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION is_org_admin_for_organization(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role = 'org_admin'
  );
END;
$$;

-- Drop the problematic org admin delete policy
DROP POLICY IF EXISTS "Org admins can delete any league" ON leagues;

-- Create new org admin delete policy using the security definer function
-- This uses a subquery to get organization_id without triggering SELECT policies
CREATE POLICY "Org admins can delete any league"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    is_org_admin_for_organization(
      (SELECT organization_id FROM leagues WHERE id = leagues.id)
    )
  );

-- Wait, this still has the same issue. Let me fix it properly.
-- The key is to NOT reference leagues.organization_id in a way that triggers SELECT

DROP POLICY IF EXISTS "Org admins can delete any league" ON leagues;

-- Create new policy that passes organization_id directly without implicit SELECT
CREATE POLICY "Org admins can delete any league"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    is_org_admin_for_organization(organization_id)
  );

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION is_org_admin_for_organization(UUID) TO authenticated;
