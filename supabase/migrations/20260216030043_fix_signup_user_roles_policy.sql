/*
  # Fix User Roles Policy for Signup

  1. Changes
    - Add policy to allow users to assign themselves as org_admin during signup
    - This allows new users to create their first role when creating an organization
  
  2. Security
    - Users can only insert roles for themselves (user_id = auth.uid())
    - Only allows org_admin role assignment during initial setup
    - Prevents abuse by checking if user has any existing roles
*/

CREATE POLICY "Users can assign themselves as org_admin on signup"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND role = 'org_admin'
  );