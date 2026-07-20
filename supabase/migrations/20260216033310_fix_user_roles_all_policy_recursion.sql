/*
  # Fix User Roles Policy Recursion
  
  1. Changes
    - Drop the "FOR ALL" policy that causes circular dependency
    - Replace with separate INSERT, UPDATE, DELETE policies for org admins
    - Keep the simple SELECT policy for users to view their own roles
    
  2. Security
    - Users can view their own roles (no circular dependency)
    - Only org_admins and super_admins can manage other users' roles
*/

-- Drop the problematic ALL policy
DROP POLICY IF EXISTS "Org admins can manage roles" ON user_roles;

-- Create separate policies for INSERT, UPDATE, DELETE (not SELECT)
CREATE POLICY "Org admins can insert roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.organization_id = user_roles.organization_id
        AND ur.role IN ('org_admin', 'super_admin')
    )
  );

CREATE POLICY "Org admins can update roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.organization_id = user_roles.organization_id
        AND ur.role IN ('org_admin', 'super_admin')
    )
  );

CREATE POLICY "Org admins can delete roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.organization_id = user_roles.organization_id
        AND ur.role IN ('org_admin', 'super_admin')
    )
  );
