/*
  # Add League Substitute System

  1. Changes
    - Add is_active_roster column to league_teams to track who's playing this week
    - Add week_roster table to track weekly roster changes
    - Update team_players to properly support substitute tracking
    
  2. New Tables
    - week_rosters: Tracks which players are active for each team each week
    
  3. Security
    - Team captains can manage their roster
    - Users can view rosters in their organization
*/

-- Add is_active_roster to league_teams (if not already there)
ALTER TABLE league_teams 
ADD COLUMN IF NOT EXISTS is_active_roster boolean DEFAULT true;

-- Create week_rosters table to track weekly roster changes
CREATE TABLE IF NOT EXISTS week_rosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_week_id uuid REFERENCES league_weeks(id) ON DELETE CASCADE NOT NULL,
  division_id uuid REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
  player_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(league_week_id, division_id, player_user_id)
);

-- Enable RLS on week_rosters
ALTER TABLE week_rosters ENABLE ROW LEVEL SECURITY;

-- Allow users to view week rosters in their organization
CREATE POLICY "Users can view week rosters in their organization"
  ON week_rosters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN leagues l ON l.id = s.league_id
      JOIN user_roles ur ON ur.organization_id = l.organization_id
      WHERE d.id = week_rosters.division_id
        AND ur.user_id = auth.uid()
    )
  );

-- Allow team captains and admins to manage week rosters
CREATE POLICY "Team captains can manage their week rosters"
  ON week_rosters
  FOR ALL
  TO authenticated
  USING (
    -- User is the team captain
    EXISTS (
      SELECT 1 FROM league_teams lt
      WHERE lt.division_id = week_rosters.division_id
        AND lt.user_id = auth.uid()
        AND lt.is_captain = true
    )
    OR
    -- User is an org admin
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN leagues l ON l.id = s.league_id
      JOIN user_roles ur ON ur.organization_id = l.organization_id
      WHERE d.id = week_rosters.division_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('org_admin', 'league_director')
    )
  )
  WITH CHECK (
    -- User is the team captain
    EXISTS (
      SELECT 1 FROM league_teams lt
      WHERE lt.division_id = week_rosters.division_id
        AND lt.user_id = auth.uid()
        AND lt.is_captain = true
    )
    OR
    -- User is an org admin
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN leagues l ON l.id = s.league_id
      JOIN user_roles ur ON ur.organization_id = l.organization_id
      WHERE d.id = week_rosters.division_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('org_admin', 'league_director')
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_week_rosters_week ON week_rosters(league_week_id);
CREATE INDEX IF NOT EXISTS idx_week_rosters_division ON week_rosters(division_id);
CREATE INDEX IF NOT EXISTS idx_week_rosters_player ON week_rosters(player_user_id);

-- Update team_players RLS to allow users to join as substitutes
DROP POLICY IF EXISTS "Users can join teams as substitutes" ON team_players;

CREATE POLICY "Users can join teams as substitutes"
  ON team_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND is_substitute = true
  );
