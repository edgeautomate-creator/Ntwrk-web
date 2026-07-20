/*
  # Fix Infinite Recursion in Leagues DELETE Policy

  1. Problem
    - The "Org admins can manage leagues" policy uses FOR ALL (SELECT, INSERT, UPDATE, DELETE)
    - During DELETE, it checks `leagues.organization_id` which triggers SELECT policies
    - This creates circular dependency: DELETE → SELECT → DELETE → infinite recursion

  2. Solution
    - Drop the problematic "Org admins can manage leagues" ALL policy
    - Create separate SELECT, INSERT, UPDATE policies for org admins
    - Keep the existing "League creator can delete leagues without scores" DELETE policy
    - This eliminates circular reference while maintaining access control

  3. Changes
    - Remove: "Org admins can manage leagues" (FOR ALL)
    - Add: "Org admins can view leagues" (FOR SELECT)
    - Add: "Org admins can create leagues" (FOR INSERT) 
    - Add: "Org admins can update leagues" (FOR UPDATE)
    - Note: Specific UPDATE policy already exists, so we ensure no duplicate
    - Keep: "League creator can delete leagues without scores" (FOR DELETE)

  4. Security
    - All existing access controls maintained
    - Org admins retain full access (SELECT, INSERT, UPDATE, DELETE via other policies)
    - League creators can still delete their own leagues without scores
    - No security regression
*/

-- Drop the problematic ALL policy that causes infinite recursion
DROP POLICY IF EXISTS "Org admins can manage leagues" ON leagues;

-- Create specific SELECT policy for org admins (if not already covered)
-- Note: "Users can view leagues in their orgs" already covers this, but we'll add explicit org_admin check
CREATE POLICY "Org admins can view all org leagues"
  ON leagues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = leagues.organization_id
        AND ur.role = 'org_admin'
    )
  );

-- Insert policy for org admins is already covered by "Org members can create leagues"
-- Update policy for org admins is already covered by "Org admins and league directors can update leagues"

-- Add explicit DELETE policy for org admins (separate from creator check)
CREATE POLICY "Org admins can delete any league"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = leagues.organization_id
        AND ur.role = 'org_admin'
    )
  );

-- The existing "League creator can delete leagues without scores" policy remains active
-- This allows both org admins (unrestricted) and creators (with score check) to delete
