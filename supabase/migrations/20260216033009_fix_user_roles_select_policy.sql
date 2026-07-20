/*
  # Fix User Roles SELECT Policy
  
  1. Changes
    - Drop the existing circular dependency SELECT policy on user_roles
    - Add a new policy that allows users to view their own roles directly
    
  2. Security
    - Users can only view their own user_roles records
    - This fixes the circular dependency where users couldn't query their roles
*/

DROP POLICY IF EXISTS "Users can view roles in their organizations" ON user_roles;

CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
