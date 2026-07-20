/*
  # Fix User Roles Infinite Recursion - Complete Fix

  1. Changes
    - Drop ALL existing policies on user_roles
    - Create security definer function to check admin status
    - Create new non-recursive policies
    
  2. Security
    - Users can manage their own roles
    - Admins can manage all roles in their organization
    - Uses security definer function to avoid recursion
*/

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can delete own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can create own roles" ON user_roles;
DROP POLICY IF EXISTS "Org admins can view org roles" ON user_roles;
DROP POLICY IF EXISTS "Org admins can manage roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view org roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert org roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update org roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete org roles" ON user_roles;

-- Drop function if exists
DROP FUNCTION IF EXISTS is_org_admin(uuid, uuid);

-- Create a function to check if user is admin (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_org_admin(check_user_id uuid, check_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
      AND organization_id = check_org_id
      AND role = 'admin'
  );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION is_org_admin(uuid, uuid) TO authenticated;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own roles
CREATE POLICY "Users can insert own roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own roles
CREATE POLICY "Users can update own roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own roles
CREATE POLICY "Users can delete own roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can view all roles in their org
CREATE POLICY "Admins can view org roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

-- Policy: Admins can insert roles in their org
CREATE POLICY "Admins can insert org roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(auth.uid(), organization_id));

-- Policy: Admins can update roles in their org
CREATE POLICY "Admins can update org roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id))
  WITH CHECK (is_org_admin(auth.uid(), organization_id));

-- Policy: Admins can delete roles in their org
CREATE POLICY "Admins can delete org roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));
