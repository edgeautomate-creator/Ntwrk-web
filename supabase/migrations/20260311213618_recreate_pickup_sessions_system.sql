/*
  # Recreate Pickup Sessions System

  1. New Tables
    - `pickup_sessions`
      - `id` (uuid, primary key)
      - `created_by` (uuid, references profiles)
      - `name` (text)
      - `format` (text: 'singles' or 'doubles')
      - `capacity` (int)
      - `best_of` (int: 1, 3, or 5)
      - `dupr_rated` (boolean)
      - `visibility` (text)
      - `status` (text: 'draft', 'active', 'completed')
      - `share_token` (uuid, unique)
      - `dupr_club_id` (text, nullable)
      - `dupr_club_name` (text, nullable)
      - `session_date` (date, nullable)
      - `session_time` (time, nullable)
      - `created_at`, `updated_at` (timestamptz)
    
    - `pickup_session_players`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references pickup_sessions)
      - `user_id` (uuid, references profiles, nullable)
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
      - Player fields (user_id and name for each position)
      - Game scores (best-of-3 or best-of-5)
      - `winner_side` (text: 'team1', 'team2', nullable)
      - `dupr_match_id` (bigint, nullable)
      - `match_datetime` (timestamptz, nullable)
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public can view sessions with share_token
    - Authenticated users can create sessions
    - Session creators can manage their sessions
*/

-- Create pickup_sessions table
CREATE TABLE IF NOT EXISTS pickup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  format text NOT NULL CHECK (format IN ('singles', 'doubles')),
  capacity int NOT NULL CHECK (capacity >= 2 AND capacity <= 100),
  best_of int DEFAULT 1 CHECK (best_of IN (1, 3, 5)),
  dupr_rated boolean DEFAULT false,
  visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  share_token uuid DEFAULT gen_random_uuid() UNIQUE,
  dupr_club_id text,
  dupr_club_name text,
  session_date date,
  session_time time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pickup_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view sessions by share token"
  ON pickup_sessions FOR SELECT
  USING (visibility = 'public' OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create sessions"
  ON pickup_sessions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Session creators can update their sessions"
  ON pickup_sessions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Session creators can delete their sessions"
  ON pickup_sessions FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create pickup_session_players table
CREATE TABLE IF NOT EXISTS pickup_session_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES pickup_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  player_name text NOT NULL,
  dupr_id text,
  dupr_rating numeric,
  joined_at timestamptz DEFAULT now(),
  joined_round int,
  status text DEFAULT 'active' CHECK (status IN ('active', 'left', 'injured'))
);

ALTER TABLE pickup_session_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view players in public sessions"
  ON pickup_session_players FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE visibility = 'public'
    )
    OR session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Session creators can add players"
  ON pickup_session_players FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Session creators can update players"
  ON pickup_session_players FOR UPDATE
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Session creators can remove players"
  ON pickup_session_players FOR DELETE
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  );

-- Create pickup_rounds table
CREATE TABLE IF NOT EXISTS pickup_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES pickup_sessions(id) ON DELETE CASCADE NOT NULL,
  round_number int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, round_number)
);

ALTER TABLE pickup_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rounds in public sessions"
  ON pickup_rounds FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE visibility = 'public'
    )
    OR session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
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
  
  -- Singles participants (user_id nullable for manual players)
  player_a_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  player_a_name text,
  player_a_dupr_id text,
  
  player_b_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  player_b_name text,
  player_b_dupr_id text,
  
  -- Doubles participants (user_id nullable for manual players)
  team1_player1_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team1_player1_name text,
  team1_player1_dupr_id text,
  
  team1_player2_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team1_player2_name text,
  team1_player2_dupr_id text,
  
  team2_player1_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team2_player1_name text,
  team2_player1_dupr_id text,
  
  team2_player2_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team2_player2_name text,
  team2_player2_dupr_id text,
  
  -- Best-of-5 game scores
  game1_team1_points int,
  game1_team2_points int,
  game2_team1_points int,
  game2_team2_points int,
  game3_team1_points int,
  game3_team2_points int,
  game4_team1_points int,
  game4_team2_points int,
  game5_team1_points int,
  game5_team2_points int,
  
  winner_side text CHECK (winner_side IN ('team1', 'team2')),
  dupr_match_id bigint,
  match_datetime timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pickup_matchups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view matchups in public sessions"
  ON pickup_matchups FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE visibility = 'public'
    )
    OR session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
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

CREATE POLICY "Session creators can update matchups"
  ON pickup_matchups FOR UPDATE
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM pickup_sessions WHERE created_by = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pickup_sessions_created_by ON pickup_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_pickup_sessions_status ON pickup_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pickup_sessions_share_token ON pickup_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_pickup_session_players_session ON pickup_session_players(session_id);
CREATE INDEX IF NOT EXISTS idx_pickup_session_players_user ON pickup_session_players(user_id);
CREATE INDEX IF NOT EXISTS idx_pickup_rounds_session ON pickup_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_session ON pickup_matchups(session_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_round ON pickup_matchups(round_id);
