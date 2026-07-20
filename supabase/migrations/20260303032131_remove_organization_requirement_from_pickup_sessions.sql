/*
  # Remove Organization Requirement from Pickup Sessions

  ## Overview
  Allow any authenticated user to create pickup sessions without requiring organization membership.
  DUPR-rated sessions will require a linked DUPR account, but not organization membership.

  ## Changes Made

  1. **Schema Updates**
     - Make `tenant_id` column nullable in `pickup_sessions` table
     - Allows pickup sessions to exist independently of organizations

  2. **RLS Policy Updates**
     - **INSERT Policy**: Allow any authenticated user to create pickup sessions
       - Remove organization membership requirement
       - Only require that created_by matches the authenticated user
     - **SELECT Policy**: Allow users to view pickup sessions where:
       - They are the creator, OR
       - The session has no organization (tenant_id IS NULL), OR
       - They belong to the session's organization
     - **UPDATE Policy**: Unchanged - only creators can update their sessions

  ## Security Notes
  - Users can only create sessions with themselves as the creator
  - Public sessions (tenant_id IS NULL) are viewable by all authenticated users
  - Organization-scoped sessions remain private to organization members
  - Only session creators can modify their sessions
*/

-- Make tenant_id nullable to allow pickup sessions without organizations
ALTER TABLE pickup_sessions 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Update INSERT policy to allow any authenticated user to create pickup sessions
DROP POLICY IF EXISTS "Users can create pickup sessions" ON pickup_sessions;

CREATE POLICY "Authenticated users can create pickup sessions"
  ON pickup_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

-- Update SELECT policy to allow viewing of:
-- 1. Sessions created by the user
-- 2. Public sessions (tenant_id IS NULL)
-- 3. Sessions in organizations the user belongs to
DROP POLICY IF EXISTS "Users can view pickup sessions in their org" ON pickup_sessions;

CREATE POLICY "Users can view pickup sessions"
  ON pickup_sessions FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR tenant_id IS NULL
    OR tenant_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );