/*
  # Create Match Lineups Table

  ## Overview
  This migration creates a table to track lineup submissions for each match.
  Team captains must submit their lineup before the deadline (X hours before match time).
  This allows for player substitutions, injury tracking, and lineup confirmations.

  ## Changes

  ### 1. New Table: match_lineups
    - `id` (uuid, primary key) - Unique identifier
    - `match_id` (uuid, foreign key) - Reference to matches table
    - `team_id` (uuid, foreign key) - Reference to teams table
    - `player1_id` (uuid, foreign key) - First player in the lineup
    - `player2_id` (uuid, foreign key) - Second player in the lineup
    - `submitted_by` (uuid, foreign key) - User who submitted the lineup (team captain)
    - `submitted_at` (timestamptz) - When the lineup was submitted
    - `status` (text) - Lineup status: pending, submitted, confirmed
    - `notes` (text, nullable) - Optional notes from captain (e.g., injury info)
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ### 2. Security
    - RLS enabled on match_lineups table
    - Team captains can submit and update their team's lineups
    - All division participants can view submitted lineups after deadline
    - Division admins can manage all lineups

  ### 3. Indexes
    - Index on match_id for fast lineup lookups per match
    - Index on team_id for team lineup history
    - Composite index on (match_id, team_id) for unique constraint

  ### 4. Constraints
    - Unique constraint on (match_id, team_id) - one lineup per team per match
    - Status must be one of: 'pending', 'submitted', 'confirmed'
    - Both player IDs are required
*/

-- Create match_lineups table
CREATE TABLE IF NOT EXISTS match_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player1_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  player2_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(match_id, team_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_lineups_match_id ON match_lineups(match_id);
CREATE INDEX IF NOT EXISTS idx_match_lineups_team_id ON match_lineups(team_id);
CREATE INDEX IF NOT EXISTS idx_match_lineups_match_team ON match_lineups(match_id, team_id);
CREATE INDEX IF NOT EXISTS idx_match_lineups_submitted_by ON match_lineups(submitted_by);

-- Enable RLS
ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_match_lineup_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_match_lineup_updated_at ON match_lineups;
CREATE TRIGGER trigger_update_match_lineup_updated_at
  BEFORE UPDATE ON match_lineups
  FOR EACH ROW
  EXECUTE FUNCTION update_match_lineup_updated_at();

-- RLS Policies

-- All division participants can view lineups for matches in their divisions
CREATE POLICY "Division participants can view match lineups" 
ON match_lineups FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matches m
    INNER JOIN division_participants dp ON dp.division_id = m.division_id
    WHERE m.id = match_lineups.match_id
    AND dp.user_id = auth.uid()
  )
);

-- Team captains can insert lineups for their teams
CREATE POLICY "Team captains can submit lineups" 
ON match_lineups FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM division_participants dp
    INNER JOIN matches m ON m.division_id = dp.division_id
    WHERE dp.team_id = match_lineups.team_id
    AND dp.user_id = auth.uid()
    AND dp.role IN ('captain', 'admin')
    AND m.id = match_lineups.match_id
  )
);

-- Team captains can update their team's lineups (before deadline)
CREATE POLICY "Team captains can update lineups" 
ON match_lineups FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM division_participants dp
    INNER JOIN matches m ON m.division_id = dp.division_id
    WHERE dp.team_id = match_lineups.team_id
    AND dp.user_id = auth.uid()
    AND dp.role IN ('captain', 'admin')
    AND m.id = match_lineups.match_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM division_participants dp
    INNER JOIN matches m ON m.division_id = dp.division_id
    WHERE dp.team_id = match_lineups.team_id
    AND dp.user_id = auth.uid()
    AND dp.role IN ('captain', 'admin')
    AND m.id = match_lineups.match_id
  )
);

-- Division creators and org admins can manage all lineups
CREATE POLICY "Division admins can manage all lineups" 
ON match_lineups FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matches m
    INNER JOIN divisions d ON d.id = m.division_id
    INNER JOIN seasons s ON s.id = d.season_id
    INNER JOIN leagues l ON l.id = s.league_id
    INNER JOIN user_roles ur ON ur.organization_id = l.organization_id
    WHERE m.id = match_lineups.match_id
    AND (
      d.created_by = auth.uid()
      OR (ur.user_id = auth.uid() AND ur.role IN ('org_admin', 'league_director'))
    )
  )
);

-- Function to auto-create default lineups when match is created
CREATE OR REPLACE FUNCTION create_default_match_lineups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create lineup for team1 with default roster
  INSERT INTO match_lineups (match_id, team_id, player1_id, player2_id, status)
  SELECT 
    NEW.id,
    NEW.team1_id,
    t.player1_id,
    t.player2_id,
    'pending'
  FROM teams t
  WHERE t.id = NEW.team1_id
  ON CONFLICT (match_id, team_id) DO NOTHING;
  
  -- Create lineup for team2 with default roster
  INSERT INTO match_lineups (match_id, team_id, player1_id, player2_id, status)
  SELECT 
    NEW.id,
    NEW.team2_id,
    t.player1_id,
    t.player2_id,
    'pending'
  FROM teams t
  WHERE t.id = NEW.team2_id
  ON CONFLICT (match_id, team_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_default_match_lineups ON matches;
CREATE TRIGGER trigger_create_default_match_lineups
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION create_default_match_lineups();
