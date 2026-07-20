/*
  # Create Tournaments System

  ## Overview
  Simplified tournament management system replacing leagues functionality.
  
  ## New Tables
  
  ### `tournaments`
  - `id` (uuid, primary key)
  - `name` (text) - Tournament name
  - `created_by` (uuid) - References auth.users
  - `date` (date, optional) - Tournament date
  - `start_time` (time, optional) - Start time
  - `location` (text, optional) - Location
  - `expected_teams` (integer) - Number of teams (2-12)
  - `playoff_teams` (integer) - Teams advancing to playoffs (2-6)
  - `format` (text) - "round_robin" or "group_stage_playoffs"
  - `best_of` (integer) - Best of 1, 3, or 5
  - `is_private` (boolean) - Public or private tournament
  - `access_code` (text, optional) - Password for private tournaments
  - `share_token` (uuid) - Unique token for shareable link
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `tournament_participants`
  - `id` (uuid, primary key)
  - `tournament_id` (uuid) - References tournaments
  - `user_id` (uuid) - References auth.users
  - `status` (text) - "approved", "pending", "rejected"
  - `joined_at` (timestamptz)
  
  ### `tournament_matches`
  - `id` (uuid, primary key)
  - `tournament_id` (uuid) - References tournaments
  - `round` (text) - "group_a", "group_b", "quarterfinal", "semifinal", "final", etc.
  - `team1_id` (uuid) - References tournament_participants
  - `team2_id` (uuid) - References tournament_participants
  - `team1_score` (integer)
  - `team2_score` (integer)
  - `winner_id` (uuid, optional) - References tournament_participants
  - `match_date` (timestamptz)
  - `created_at` (timestamptz)
  
  ## Security
  - Enable RLS on all tables
  - Public tournaments viewable by all authenticated users
  - Private tournaments only viewable by participants and creator
  - Only creator can approve join requests
  - Participants can enter match scores
*/

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  date date,
  start_time time,
  location text,
  expected_teams integer NOT NULL CHECK (expected_teams >= 2 AND expected_teams <= 12),
  playoff_teams integer NOT NULL CHECK (playoff_teams >= 2 AND playoff_teams <= 6),
  format text NOT NULL CHECK (format IN ('round_robin', 'group_stage_playoffs')),
  best_of integer NOT NULL CHECK (best_of IN (1, 3, 5)) DEFAULT 1,
  is_private boolean DEFAULT false,
  access_code text,
  share_token uuid DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Tournament participants
CREATE TABLE IF NOT EXISTS tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')) DEFAULT 'pending',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- Tournament matches
CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  round text NOT NULL,
  team1_id uuid REFERENCES tournament_participants(id) NOT NULL,
  team2_id uuid REFERENCES tournament_participants(id) NOT NULL,
  team1_score integer DEFAULT 0,
  team2_score integer DEFAULT 0,
  winner_id uuid REFERENCES tournament_participants(id),
  match_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments

CREATE POLICY "Anyone can view public tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (is_private = false);

CREATE POLICY "Participants can view private tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (
    is_private = true AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM tournament_participants
        WHERE tournament_participants.tournament_id = tournaments.id
        AND tournament_participants.user_id = auth.uid()
        AND tournament_participants.status = 'approved'
      )
    )
  );

CREATE POLICY "Users can create tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update their tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can delete their tournaments"
  ON tournaments FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for tournament_participants

CREATE POLICY "Anyone can view participants of public tournaments"
  ON tournament_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.is_private = false
    )
  );

CREATE POLICY "Participants and creators can view private tournament participants"
  ON tournament_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND (
        tournaments.created_by = auth.uid() OR
        (tournament_participants.user_id = auth.uid() AND tournament_participants.status = 'approved')
      )
    )
  );

CREATE POLICY "Users can request to join tournaments"
  ON tournament_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creators can update participant status"
  ON tournament_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );

-- RLS Policies for tournament_matches

CREATE POLICY "Anyone can view matches of public tournaments"
  ON tournament_matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_matches.tournament_id
      AND tournaments.is_private = false
    )
  );

CREATE POLICY "Participants can view private tournament matches"
  ON tournament_matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
      AND (
        t.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tournament_participants tp
          WHERE tp.tournament_id = t.id
          AND tp.user_id = auth.uid()
          AND tp.status = 'approved'
        )
      )
    )
  );

CREATE POLICY "Creators can create matches"
  ON tournament_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_matches.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );

CREATE POLICY "Participants can update match scores"
  ON tournament_matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
      AND (
        t.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tournament_participants tp
          WHERE tp.tournament_id = t.id
          AND tp.user_id = auth.uid()
          AND tp.status = 'approved'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
      AND (
        t.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tournament_participants tp
          WHERE tp.tournament_id = t.id
          AND tp.user_id = auth.uid()
          AND tp.status = 'approved'
        )
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_tournaments_updated_at ON tournaments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user_id ON tournament_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON tournament_matches(tournament_id);
