/*
  # Fix Infinite Recursion in League Deletion Policy

  1. Problem
    - The `can_delete_league_as_org_admin()` function queries the `leagues` table
    - This query triggers SELECT policies on `leagues` that reference `leagues.organization_id`
    - Accessing `organization_id` requires reading the league row, creating infinite recursion
  
  2. Solution
    - Update the security definer function to explicitly disable RLS using `SET LOCAL row_security = OFF`
    - This allows the function to read from `leagues` without triggering RLS policies
    - Breaks the circular dependency completely
  
  3. Security
    - The function is SECURITY DEFINER, so it runs with elevated privileges
    - It only exposes a boolean result (whether user is org admin)
    - Does not leak any sensitive data
    - The DELETE policy still enforces proper authorization
*/

-- Drop the policy that depends on the function
DROP POLICY IF EXISTS "Org admins can delete any league" ON leagues;

-- Drop and recreate the function with RLS bypass
DROP FUNCTION IF EXISTS can_delete_league_as_org_admin(UUID);

CREATE OR REPLACE FUNCTION can_delete_league_as_org_admin(league_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Disable RLS for this function's queries to prevent recursion
  SET LOCAL row_security = OFF;
  
  -- Get organization_id without triggering RLS policies
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

-- Recreate the policy using the updated function
CREATE POLICY "Org admins can delete any league"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (can_delete_league_as_org_admin(id));
