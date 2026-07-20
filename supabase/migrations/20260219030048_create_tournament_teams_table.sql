/*
  # Create Tournament Teams System

  1. New Tables
    - `tournament_teams`
      - `id` (uuid, primary key)
      - `tournament_id` (uuid, references tournaments)
      - `team_number` (integer, 1-12 for team position)
      - `player1_name` (text, nullable - player 1 name)
      - `player1_dupr_id` (text, nullable - player 1 DUPR ID)
      - `player1_rating` (numeric, nullable - player 1 DUPR rating)
      - `player2_name` (text, nullable - player 2 name)
      - `player2_dupr_id` (text, nullable - player 2 DUPR ID)
      - `player2_rating` (numeric, nullable - player 2 DUPR rating)
      - `claimed_by_user_id` (uuid, nullable - user who claimed this team slot)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `tournament_teams` table
    - Add policy for viewing teams (anyone can view)
    - Add policy for claiming teams (authenticated users can claim empty slots)
    - Add policy for updating teams (only the user who claimed can update)
  
  3. Important Notes
    - Teams are auto-created when tournament is created
    - `team_number` indicates position (Team 1, Team 2, etc.)
    - Players can claim a team spot and fill in their DUPR info
*/

CREATE TABLE IF NOT EXISTS tournament_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  team_number integer NOT NULL CHECK (team_number >= 1 AND team_number <= 12),
  player1_name text,
  player1_dupr_id text,
  player1_rating numeric(4, 2),
  player2_name text,
  player2_dupr_id text,
  player2_rating numeric(4, 2),
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, team_number)
);

ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament teams"
  ON tournament_teams
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can claim empty team slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (claimed_by_user_id IS NULL)
  WITH CHECK (auth.uid() = claimed_by_user_id);

CREATE POLICY "Users can update their claimed teams"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = claimed_by_user_id)
  WITH CHECK (auth.uid() = claimed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_claimed_by ON tournament_teams(claimed_by_user_id);
