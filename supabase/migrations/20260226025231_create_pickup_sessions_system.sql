/*
  # Create Pickup Sessions System

  1. New Tables
    - `pickup_sessions`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, references organizations)
      - `created_by` (uuid, references auth.users)
      - `name` (text)
      - `format` (text: 'singles' or 'doubles')
      - `capacity` (int)
      - `dupr_rated` (boolean)
      - `visibility` (text)
      - `status` (text: 'draft', 'active', 'completed')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `pickup_session_players`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references pickup_sessions)
      - `user_id` (uuid, references auth.users)
      - `player_name` (text)
      - `dupr_id` (text, nullable)
      - `dupr_rating` (numeric, nullable)
      - `joined_at` (timestamptz)
      - `joined_round` (int, nullable)
      - `status` (text: 'active', 'left', 'injured')
    
    - `pickup_rounds`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references pickup_sessions)
      - `round_number` (int)
      - `created_at` (timestamptz)
    
    - `pickup_matchups`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references pickup_sessions)
      - `round_id` (uuid, references pickup_rounds)
      - `round_number` (int)
      - `format` (text: 'singles' or 'doubles')
      - `status` (text: 'scheduled', 'in_progress', 'completed', 'skipped', 'not_played')
      - Singles fields:
        - `player_a_user_id` (uuid, nullable)
        - `player_b_user_id` (uuid, nullable)
      - Doubles fields:
        - `team1_player1_user_id` (uuid, nullable)
        - `team1_player2_user_id` (uuid, nullable)
        - `team2_player1_user_id` (uuid, nullable)
        - `team2_player2_user_id` (uuid, nullable)
      - Game scores (Best-of-3):
        - `game1_team1_points` (int, nullable)
        - `game1_team2_points` (int, nullable)
        - `game2_team1_points` (int, nullable)
        - `game2_team2_points` (int, nullable)
        - `game3_team1_points` (int, nullable)
        - `game3_team2_points` (int, nullable)
      - `winner_side` (text: 'team1', 'team2', nullable)
      - `dupr_submission_status` (text, nullable)
      - `dupr_submission_error` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create pickup_sessions table
CREATE TABLE IF NOT EXISTS pickup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  format text NOT NULL CHECK (format IN ('singles', 'doubles')),
  capacity int NOT NULL CHECK (capacity >= 2),
  dupr_rated boolean DEFAULT false,
  visibility text DEFAULT 'public',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pickup_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pickup sessions in their org"
  ON pickup_sessions FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create pickup sessions"
  ON pickup_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Session creators can update their sessions"
  ON pickup_sessions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Create pickup_session_players table
CREATE TABLE IF NOT EXISTS pickup_session_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES pickup_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  player_name text NOT NULL,
  dupr_id text,
  dupr_rating numeric,
  joined_at timestamptz DEFAULT now(),
  joined_round int,
  status text DEFAULT 'active' CHECK (status IN ('active', 'left', 'injured')),
  UNIQUE(session_id, user_id)
);

ALTER TABLE pickup_session_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view players in sessions they can view"
  ON pickup_session_players FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE tenant_id IN (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can join pickup sessions"
  ON pickup_session_players FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND session_id IN (
      SELECT id FROM pickup_sessions WHERE tenant_id IN (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own player status"
  ON pickup_session_players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create pickup_rounds table
CREATE TABLE IF NOT EXISTS pickup_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES pickup_sessions(id) ON DELETE CASCADE NOT NULL,
  round_number int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, round_number)
);

ALTER TABLE pickup_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rounds in sessions they can view"
  ON pickup_rounds FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE tenant_id IN (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Session creators can create rounds"
  ON pickup_rounds FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  );

-- Create pickup_matchups table
CREATE TABLE IF NOT EXISTS pickup_matchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES pickup_sessions(id) ON DELETE CASCADE NOT NULL,
  round_id uuid REFERENCES pickup_rounds(id) ON DELETE CASCADE NOT NULL,
  round_number int NOT NULL,
  format text NOT NULL CHECK (format IN ('singles', 'doubles')),
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'skipped', 'not_played')),
  
  -- Singles participants
  player_a_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  player_b_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Doubles participants
  team1_player1_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team1_player2_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team2_player1_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team2_player2_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Best-of-3 game scores
  game1_team1_points int,
  game1_team2_points int,
  game2_team1_points int,
  game2_team2_points int,
  game3_team1_points int,
  game3_team2_points int,
  
  winner_side text CHECK (winner_side IN ('team1', 'team2')),
  dupr_submission_status text,
  dupr_submission_error text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pickup_matchups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view matchups in sessions they can view"
  ON pickup_matchups FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE tenant_id IN (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Session creators can create matchups"
  ON pickup_matchups FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Participants and creators can update matchup scores"
  ON pickup_matchups FOR UPDATE
  TO authenticated
  USING (
    session_id IN (SELECT id FROM pickup_sessions WHERE created_by = auth.uid())
    OR (format = 'singles' AND (player_a_user_id = auth.uid() OR player_b_user_id = auth.uid()))
    OR (format = 'doubles' AND (
      team1_player1_user_id = auth.uid() OR 
      team1_player2_user_id = auth.uid() OR 
      team2_player1_user_id = auth.uid() OR 
      team2_player2_user_id = auth.uid()
    ))
  )
  WITH CHECK (
    session_id IN (SELECT id FROM pickup_sessions WHERE created_by = auth.uid())
    OR (format = 'singles' AND (player_a_user_id = auth.uid() OR player_b_user_id = auth.uid()))
    OR (format = 'doubles' AND (
      team1_player1_user_id = auth.uid() OR 
      team1_player2_user_id = auth.uid() OR 
      team2_player1_user_id = auth.uid() OR 
      team2_player2_user_id = auth.uid()
    ))
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pickup_sessions_tenant ON pickup_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pickup_sessions_created_by ON pickup_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_pickup_sessions_status ON pickup_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pickup_session_players_session ON pickup_session_players(session_id);
CREATE INDEX IF NOT EXISTS idx_pickup_session_players_user ON pickup_session_players(user_id);
CREATE INDEX IF NOT EXISTS idx_pickup_rounds_session ON pickup_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_session ON pickup_matchups(session_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_round ON pickup_matchups(round_id);