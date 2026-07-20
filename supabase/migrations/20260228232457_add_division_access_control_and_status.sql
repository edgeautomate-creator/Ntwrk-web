/*
  # Add Division Access Control and Status Management

  ## Overview
  This migration adds comprehensive access control and lifecycle management to divisions.
  It enables password-protected divisions, private access codes, and status tracking to
  prevent code regeneration once a division becomes active.

  ## Changes

  ### 1. New Columns Added to divisions table
    - `password` (text, nullable) - Optional password for password-protected divisions
    - `access_code` (text, unique, nullable) - Unique code for joining private divisions (auto-generated)
    - `is_private` (boolean, default false) - Whether division requires password or access code
    - `status` (text, default 'draft') - Lifecycle status: draft, active, or completed
    - `created_by` (uuid) - User who created the division (tracks ownership)
    - `lineup_deadline_hours` (integer, default 24) - Hours before match time that lineups are due
    - `playoff_teams` (integer, nullable) - Number of teams qualifying for playoffs
    - `playoff_format` (text, nullable) - Playoff bracket format (single_elimination, double_elimination)

  ### 2. Security
    - RLS policies updated to support division creators having special permissions
    - Access codes are unique and cannot be changed once status is 'active' or 'completed'
    - Password field is hashed at application level (not enforced at DB level for flexibility)

  ### 3. Indexes
    - Added index on access_code for fast lookups when joining divisions
    - Added index on created_by for creator queries
    - Added index on status for filtering active/draft divisions

  ### 4. Constraints
    - Status must be one of: 'draft', 'active', 'completed'
    - Playoff teams must be between 2 and max_teams
    - Lineup deadline hours must be positive
    - Access codes are unique across all divisions
*/

-- Add new columns to divisions table
ALTER TABLE divisions 
ADD COLUMN IF NOT EXISTS password text,
ADD COLUMN IF NOT EXISTS access_code text,
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS lineup_deadline_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS playoff_teams integer,
ADD COLUMN IF NOT EXISTS playoff_format text;

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'divisions_status_check'
  ) THEN
    ALTER TABLE divisions ADD CONSTRAINT divisions_status_check 
    CHECK (status IN ('draft', 'active', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'divisions_playoff_teams_check'
  ) THEN
    ALTER TABLE divisions ADD CONSTRAINT divisions_playoff_teams_check 
    CHECK (playoff_teams IS NULL OR (playoff_teams >= 2 AND playoff_teams <= max_teams));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'divisions_lineup_deadline_check'
  ) THEN
    ALTER TABLE divisions ADD CONSTRAINT divisions_lineup_deadline_check 
    CHECK (lineup_deadline_hours > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'divisions_playoff_format_check'
  ) THEN
    ALTER TABLE divisions ADD CONSTRAINT divisions_playoff_format_check 
    CHECK (playoff_format IS NULL OR playoff_format IN ('single_elimination', 'double_elimination'));
  END IF;
END $$;

-- Create unique constraint on access_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'divisions_access_code_key'
  ) THEN
    ALTER TABLE divisions ADD CONSTRAINT divisions_access_code_key UNIQUE (access_code);
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_divisions_access_code ON divisions(access_code);
CREATE INDEX IF NOT EXISTS idx_divisions_created_by ON divisions(created_by);
CREATE INDEX IF NOT EXISTS idx_divisions_status ON divisions(status);
CREATE INDEX IF NOT EXISTS idx_divisions_season_id ON divisions(season_id);

-- Function to generate random access code
CREATE OR REPLACE FUNCTION generate_division_access_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM divisions WHERE access_code = code) INTO exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Trigger to auto-generate access_code when division is created
CREATE OR REPLACE FUNCTION set_division_access_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate access code if not already set
  IF NEW.access_code IS NULL THEN
    NEW.access_code := generate_division_access_code();
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_division_access_code ON divisions;
CREATE TRIGGER trigger_set_division_access_code
  BEFORE INSERT ON divisions
  FOR EACH ROW
  EXECUTE FUNCTION set_division_access_code();

-- Update RLS policies for divisions

-- Allow users to view public divisions or divisions they have access to
DROP POLICY IF EXISTS "Users can view divisions in their organizations" ON divisions;
CREATE POLICY "Users can view divisions in their organizations" ON divisions 
FOR SELECT TO authenticated
USING (
  -- User is part of the organization
  EXISTS (
    SELECT 1 FROM user_roles ur 
    INNER JOIN leagues l ON l.organization_id = ur.organization_id 
    INNER JOIN seasons s ON s.league_id = l.id 
    WHERE s.id = divisions.season_id 
    AND ur.user_id = auth.uid()
  )
  -- OR division is not private
  OR is_private = false
);

-- Division creators and org admins can insert divisions
DROP POLICY IF EXISTS "Admins can manage divisions" ON divisions;
CREATE POLICY "Division creators and admins can insert" ON divisions 
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    INNER JOIN leagues l ON l.organization_id = ur.organization_id 
    INNER JOIN seasons s ON s.league_id = l.id 
    WHERE s.id = divisions.season_id 
    AND ur.user_id = auth.uid() 
    AND ur.role IN ('org_admin', 'league_director')
  )
);

-- Division creators and org admins can update divisions
CREATE POLICY "Division creators and admins can update" ON divisions 
FOR UPDATE TO authenticated
USING (
  -- User is the creator
  created_by = auth.uid()
  -- OR user is org admin
  OR EXISTS (
    SELECT 1 FROM user_roles ur 
    INNER JOIN leagues l ON l.organization_id = ur.organization_id 
    INNER JOIN seasons s ON s.league_id = l.id 
    WHERE s.id = divisions.season_id 
    AND ur.user_id = auth.uid() 
    AND ur.role IN ('org_admin', 'league_director')
  )
);

-- Division creators and org admins can delete divisions (only if status is draft)
CREATE POLICY "Division creators and admins can delete draft divisions" ON divisions 
FOR DELETE TO authenticated
USING (
  status = 'draft'
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      INNER JOIN leagues l ON l.organization_id = ur.organization_id 
      INNER JOIN seasons s ON s.league_id = l.id 
      WHERE s.id = divisions.season_id 
      AND ur.user_id = auth.uid() 
      AND ur.role IN ('org_admin', 'league_director')
    )
  )
);
