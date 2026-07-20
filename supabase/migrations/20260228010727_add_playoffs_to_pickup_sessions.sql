/*
  # Add Playoff System to Pickup Sessions

  1. Changes to pickup_sessions
    - Add `has_playoffs` (boolean) - Whether this session includes playoffs
    - Add `playoff_qualifiers` (integer) - Number of players who qualify for playoffs (2, 4, 8, etc.)

  2. New Table: pickup_playoff_matchups
    - Stores playoff bracket matchups separately from regular round-robin matchups
    - Similar structure to pickup_matchups but with bracket-specific fields
    - Fields:
      - `id` (uuid, primary key)
      - `session_id` (uuid, references pickup_sessions)
      - `bracket_round` (integer) - 1 = finals, 2 = semifinals, 3 = quarterfinals, etc.
      - `match_number` (integer) - Position in that round
      - `format` (text) - singles or doubles
      - `best_of` (integer) - 1, 3, or 5
      - `status` (text) - scheduled, in_progress, completed
      - Player/team fields (same as pickup_matchups)
      - Score fields (same as pickup_matchups)
      - `winner_side` (text) - team1 or team2
      - `advances_to_match` (uuid) - Which match the winner advances to
      - Timestamps

  3. Security
    - Enable RLS on pickup_playoff_matchups
    - Add policies for viewing and score entry (same pattern as pickup_matchups)
*/

-- Add playoff fields to pickup_sessions
ALTER TABLE pickup_sessions
  ADD COLUMN IF NOT EXISTS has_playoffs boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS playoff_qualifiers integer DEFAULT 4;

-- Create pickup_playoff_matchups table
CREATE TABLE IF NOT EXISTS pickup_playoff_matchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES pickup_sessions(id) ON DELETE CASCADE,
  bracket_round integer NOT NULL,
  match_number integer NOT NULL,
  format text NOT NULL CHECK (format IN ('singles', 'doubles')),
  best_of integer NOT NULL CHECK (best_of IN (1, 3, 5)),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  
  -- Singles format players (using session_player_id)
  player_a_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  player_b_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  
  -- Doubles format players (using session_player_id)
  team1_player1_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  team1_player2_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  team2_player1_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  team2_player2_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  
  -- Keep user_ids for permission checking (backwards compatibility)
  player_a_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  player_b_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team1_player1_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team1_player2_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team2_player1_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team2_player2_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Game scores (up to best of 5)
  game1_team1_points integer,
  game1_team2_points integer,
  game2_team1_points integer,
  game2_team2_points integer,
  game3_team1_points integer,
  game3_team2_points integer,
  game4_team1_points integer,
  game4_team2_points integer,
  game5_team1_points integer,
  game5_team2_points integer,
  
  -- Match result
  winner_side text CHECK (winner_side IN ('team1', 'team2')),
  
  -- Bracket progression
  advances_to_match uuid REFERENCES pickup_playoff_matchups(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_session_id ON pickup_playoff_matchups(session_id);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_bracket_round ON pickup_playoff_matchups(bracket_round);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_status ON pickup_playoff_matchups(status);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_player_a_id ON pickup_playoff_matchups(player_a_id);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_player_b_id ON pickup_playoff_matchups(player_b_id);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_team1_player1_id ON pickup_playoff_matchups(team1_player1_id);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_team1_player2_id ON pickup_playoff_matchups(team1_player2_id);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_team2_player1_id ON pickup_playoff_matchups(team2_player1_id);
CREATE INDEX IF NOT EXISTS idx_playoff_matchups_team2_player2_id ON pickup_playoff_matchups(team2_player2_id);

-- Enable RLS
ALTER TABLE pickup_playoff_matchups ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view playoff matchups for sessions they can view
CREATE POLICY "Users can view playoff matchups for accessible sessions"
  ON pickup_playoff_matchups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = pickup_playoff_matchups.session_id
      AND (
        pickup_sessions.visibility = 'public'
        OR pickup_sessions.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM pickup_session_players
          WHERE pickup_session_players.session_id = pickup_sessions.id
          AND pickup_session_players.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: Session creator can insert playoff matchups
CREATE POLICY "Session creator can insert playoff matchups"
  ON pickup_playoff_matchups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = session_id
      AND pickup_sessions.created_by = auth.uid()
    )
  );

-- Policy: Session creator or match participants can update playoff matchups
CREATE POLICY "Session creator or participants can update playoff matchups"
  ON pickup_playoff_matchups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = session_id
      AND (
        pickup_sessions.created_by = auth.uid()
        OR player_a_user_id = auth.uid()
        OR player_b_user_id = auth.uid()
        OR team1_player1_user_id = auth.uid()
        OR team1_player2_user_id = auth.uid()
        OR team2_player1_user_id = auth.uid()
        OR team2_player2_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = session_id
      AND (
        pickup_sessions.created_by = auth.uid()
        OR player_a_user_id = auth.uid()
        OR player_b_user_id = auth.uid()
        OR team1_player1_user_id = auth.uid()
        OR team1_player2_user_id = auth.uid()
        OR team2_player1_user_id = auth.uid()
        OR team2_player2_user_id = auth.uid()
      )
    )
  );

-- Policy: Session creator can delete playoff matchups
CREATE POLICY "Session creator can delete playoff matchups"
  ON pickup_playoff_matchups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pickup_sessions
      WHERE pickup_sessions.id = session_id
      AND pickup_sessions.created_by = auth.uid()
    )
  );
