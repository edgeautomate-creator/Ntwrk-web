/*
  # Fix Team Schema and Remove Division Logic

  1. Schema Changes
    - Drop the foreign key constraint from `standings.team_id` that points to `teams` table
    - Add new foreign key constraint making `standings.team_id` reference `divisions.id`
    - Update other tables that incorrectly reference the `teams` table
    - The `divisions` table is being used as teams in the league system

  2. New Tables
    - Create `team_players` table to track which users are registered to which teams
      - Links auth.users to divisions (teams)
      - Tracks player position/slot number
      - Tracks captain status

  3. Security
    - Enable RLS on `team_players` table
    - Add policies for viewing and managing team rosters

  4. Performance
    - Add indexes on foreign keys
*/

-- Drop the incorrect foreign key constraint from standings
ALTER TABLE standings DROP CONSTRAINT IF EXISTS standings_team_id_fkey;

-- Add correct foreign key constraint pointing to divisions (which are actually teams)
ALTER TABLE standings 
  ADD CONSTRAINT standings_team_id_fkey 
  FOREIGN KEY (team_id) 
  REFERENCES divisions(id) 
  ON DELETE CASCADE;

-- Create team_players table for player registration
CREATE TABLE IF NOT EXISTS team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_position integer CHECK (player_position > 0),
  is_captain boolean DEFAULT false,
  is_substitute boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id),
  UNIQUE(team_id, player_position, is_substitute)
);

-- Add index on team_players for performance
CREATE INDEX IF NOT EXISTS idx_team_players_team_id ON team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_user_id ON team_players(user_id);
CREATE INDEX IF NOT EXISTS idx_team_players_organization_id ON team_players(organization_id);

-- Enable RLS on team_players
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view team players in their organization
CREATE POLICY "Users can view team players in their organization"
  ON team_players
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can join teams as players
CREATE POLICY "Users can join teams"
  ON team_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update their own team player records
CREATE POLICY "Users can update own team player records"
  ON team_players
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Team captains can manage their team roster
CREATE POLICY "Captains can manage team roster"
  ON team_players
  FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_players 
      WHERE user_id = auth.uid() AND is_captain = true
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_players 
      WHERE user_id = auth.uid() AND is_captain = true
    )
  );

-- Policy: Organization admins can manage all team players
CREATE POLICY "Org admins can manage team players"
  ON team_players
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Update division_players foreign key if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'division_players_division_id_fkey' 
    AND table_name = 'division_players'
  ) THEN
    -- Table exists, ensure it references divisions correctly
    ALTER TABLE division_players DROP CONSTRAINT IF EXISTS division_players_division_id_fkey;
    ALTER TABLE division_players 
      ADD CONSTRAINT division_players_division_id_fkey 
      FOREIGN KEY (division_id) 
      REFERENCES divisions(id) 
      ON DELETE CASCADE;
  END IF;
END $$;
