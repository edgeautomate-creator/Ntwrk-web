/*
  # Create Division Participants Tracking Table

  ## Overview
  This migration creates a table to track which users have joined specific divisions.
  This is essential for access control, showing "My Divisions" to users, and managing
  password-protected or private division access.

  ## Changes

  ### 1. New Table: division_participants
    - `id` (uuid, primary key) - Unique identifier
    - `division_id` (uuid, foreign key) - Reference to divisions table
    - `user_id` (uuid, foreign key) - Reference to auth.users table
    - `joined_at` (timestamptz) - When the user joined the division
    - `role` (text) - User's role in the division (participant, captain, admin)
    - `team_id` (uuid, nullable, foreign key) - Reference to teams table if user is on a team
    - `created_at` (timestamptz) - Record creation timestamp

  ### 2. Security
    - RLS enabled on division_participants table
    - Users can view their own participation records
    - Users can view other participants in divisions they've joined
    - Users can insert participation records (joining divisions)
    - Division creators and org admins can manage all participation records

  ### 3. Indexes
    - Composite index on (division_id, user_id) for fast lookups
    - Index on user_id for "My Divisions" queries
    - Index on division_id for participant lists

  ### 4. Constraints
    - Unique constraint on (division_id, user_id) - users can only join once
    - Role must be one of: 'participant', 'captain', 'admin'
*/

-- Create division_participants table
CREATE TABLE IF NOT EXISTS division_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  role text DEFAULT 'participant' CHECK (role IN ('participant', 'captain', 'admin')),
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(division_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_division_participants_division_user ON division_participants(division_id, user_id);
CREATE INDEX IF NOT EXISTS idx_division_participants_user_id ON division_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_division_participants_division_id ON division_participants(division_id);
CREATE INDEX IF NOT EXISTS idx_division_participants_team_id ON division_participants(team_id);

-- Enable RLS
ALTER TABLE division_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own participation records
CREATE POLICY "Users can view their own division participation" 
ON division_participants FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can view other participants in divisions they've joined
CREATE POLICY "Users can view participants in divisions they joined" 
ON division_participants FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM division_participants dp 
    WHERE dp.division_id = division_participants.division_id 
    AND dp.user_id = auth.uid()
  )
);

-- Users can join divisions (insert their own participation)
CREATE POLICY "Users can join divisions" 
ON division_participants FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own participation (e.g., updating role when becoming captain)
CREATE POLICY "Users can update their own participation" 
ON division_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Division creators and org admins can manage all participation records
CREATE POLICY "Division creators and admins can manage participants" 
ON division_participants FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM divisions d
    INNER JOIN seasons s ON s.id = d.season_id
    INNER JOIN leagues l ON l.id = s.league_id
    INNER JOIN user_roles ur ON ur.organization_id = l.organization_id
    WHERE d.id = division_participants.division_id
    AND (
      d.created_by = auth.uid()
      OR (ur.user_id = auth.uid() AND ur.role IN ('org_admin', 'league_director'))
    )
  )
);

-- Function to automatically add division creator as participant
CREATE OR REPLACE FUNCTION add_division_creator_as_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert creator as participant with admin role
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO division_participants (division_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (division_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_add_division_creator_as_participant ON divisions;
CREATE TRIGGER trigger_add_division_creator_as_participant
  AFTER INSERT ON divisions
  FOR EACH ROW
  EXECUTE FUNCTION add_division_creator_as_participant();
