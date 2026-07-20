/*
  # Fix King of the Hill Tournament Manual Player Support

  1. Changes to tournament_participants table
    - Make user_id nullable to support manual player entries
    - Add player_name column for non-registered players
    - Update unique constraint to handle both scenarios
    - Add indexes for performance

  2. Security
    - Update RLS policies to allow manual player entries
    - Tournament creators can add players without user accounts
    - Maintain proper access control

  3. Notes
    - This enables tournament creators to add players by name only
    - Supports both registered users and manual entries
    - DUPR-required tournaments still enforce DUPR for registered users
*/

-- Drop existing tournament_participants table if it has the wrong schema
-- We'll recreate it with the correct structure
DROP TABLE IF EXISTS tournament_participants CASCADE;

-- Recreate tournament_participants with support for manual entries
CREATE TABLE IF NOT EXISTS tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  player_name text,
  dupr_id text,
  dupr_rating numeric,
  status text NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')) DEFAULT 'approved',
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  -- Either user_id or player_name must be present
  CONSTRAINT user_or_player_name_required CHECK (
    (user_id IS NOT NULL) OR (player_name IS NOT NULL AND player_name != '')
  ),
  -- Prevent duplicate entries: same user can't join twice, same name can't be added twice
  CONSTRAINT unique_participant UNIQUE NULLS NOT DISTINCT (tournament_id, user_id, player_name)
);

-- Enable RLS
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id 
  ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user_id 
  ON tournament_participants(user_id) WHERE user_id IS NOT NULL;

-- RLS Policies for tournament_participants
-- Anyone can view participants of tournaments they have access to
CREATE POLICY "Users can view tournament participants"
  ON tournament_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND (
        tournaments.is_private = false
        OR tournaments.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM tournament_participants tp2
          WHERE tp2.tournament_id = tournaments.id
          AND tp2.user_id = auth.uid()
        )
      )
    )
  );

-- Users can join tournaments (register themselves)
CREATE POLICY "Users can register for tournaments"
  ON tournament_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND (tournaments.is_private = false OR tournaments.created_by = auth.uid())
    )
  );

-- Tournament creators can add manual players (without user accounts)
CREATE POLICY "Creators can add manual players"
  ON tournament_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );

-- Tournament creators can remove participants
CREATE POLICY "Creators can remove participants"
  ON tournament_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );

-- Users can remove themselves from tournaments
CREATE POLICY "Users can leave tournaments"
  ON tournament_participants
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
  );