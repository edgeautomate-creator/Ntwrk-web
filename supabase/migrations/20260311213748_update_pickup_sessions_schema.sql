/*
  # Update Pickup Sessions Schema

  1. Changes
    - Add `tenant_id` column (nullable, for future multi-tenancy)
    - Change `best_of` default from 1 to 3
    - Add `has_playoffs` column (boolean, default false)
    - Add `playoff_qualifiers` column (integer, default 4)
    - Add `playoff_byes` column (integer, default 0)
    - Ensure all columns match the required schema structure

  2. Notes
    - `tenant_id` is nullable to support sessions without organization requirement
    - All timestamps use timestamptz for consistency
    - Maintains existing RLS policies
*/

-- Add missing columns to pickup_sessions
DO $$ 
BEGIN
  -- Add tenant_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pickup_sessions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN tenant_id uuid;
  END IF;

  -- Add has_playoffs if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pickup_sessions' AND column_name = 'has_playoffs'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN has_playoffs boolean DEFAULT false;
  END IF;

  -- Add playoff_qualifiers if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pickup_sessions' AND column_name = 'playoff_qualifiers'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN playoff_qualifiers integer DEFAULT 4 CHECK (playoff_qualifiers >= 2);
  END IF;

  -- Add playoff_byes if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pickup_sessions' AND column_name = 'playoff_byes'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN playoff_byes integer DEFAULT 0 CHECK (playoff_byes >= 0);
  END IF;
END $$;

-- Update best_of default value to 3 (drop and recreate constraint)
ALTER TABLE pickup_sessions 
  ALTER COLUMN best_of SET DEFAULT 3;

-- Add comment to document the schema
COMMENT ON TABLE pickup_sessions IS 'Pickup game sessions supporting singles/doubles formats with optional playoffs';
COMMENT ON COLUMN pickup_sessions.tenant_id IS 'References tenant/organization (nullable for independent sessions)';
COMMENT ON COLUMN pickup_sessions.created_by IS 'User who created the session';
COMMENT ON COLUMN pickup_sessions.format IS 'Either singles or doubles';
COMMENT ON COLUMN pickup_sessions.capacity IS 'Maximum number of players';
COMMENT ON COLUMN pickup_sessions.best_of IS 'Best of format (1, 3, or 5 games)';
COMMENT ON COLUMN pickup_sessions.dupr_rated IS 'Whether session is DUPR rated';
COMMENT ON COLUMN pickup_sessions.visibility IS 'Session visibility setting (public/private)';
COMMENT ON COLUMN pickup_sessions.status IS 'Session status: draft, active, or completed';
COMMENT ON COLUMN pickup_sessions.has_playoffs IS 'Whether session includes playoffs';
COMMENT ON COLUMN pickup_sessions.playoff_qualifiers IS 'Number of players/teams qualifying for playoffs';
COMMENT ON COLUMN pickup_sessions.playoff_byes IS 'Number of playoff byes';
COMMENT ON COLUMN pickup_sessions.dupr_club_id IS 'DUPR club identifier';
COMMENT ON COLUMN pickup_sessions.dupr_club_name IS 'DUPR club name';
COMMENT ON COLUMN pickup_sessions.session_date IS 'Date of the session';
COMMENT ON COLUMN pickup_sessions.session_time IS 'Time of the session';
