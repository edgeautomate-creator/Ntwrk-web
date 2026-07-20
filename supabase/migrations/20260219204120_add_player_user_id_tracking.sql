/*
  # Add Player-Specific User ID Tracking

  1. Changes
    - Add `player1_user_id` column to track which user claimed player 1 slot
    - Add `player2_user_id` column to track which user claimed player 2 slot
    - Migrate existing `claimed_by_user_id` data to `player1_user_id`
    - Keep `claimed_by_user_id` for backward compatibility (team owner)
  
  2. Security
    - Update RLS policies to check individual player ownership
    - Users can only modify slots they own
    - Users can claim empty slots
  
  3. Important Notes
    - `player1_user_id` and `player2_user_id` track individual slot ownership
    - `claimed_by_user_id` indicates who first created/claimed the team
    - Each player slot is independently owned and managed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_teams' AND column_name = 'player1_user_id'
  ) THEN
    ALTER TABLE tournament_teams ADD COLUMN player1_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_teams' AND column_name = 'player2_user_id'
  ) THEN
    ALTER TABLE tournament_teams ADD COLUMN player2_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE tournament_teams 
SET player1_user_id = claimed_by_user_id 
WHERE claimed_by_user_id IS NOT NULL 
  AND player1_name IS NOT NULL 
  AND player1_user_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can claim empty team slots" ON tournament_teams;
DROP POLICY IF EXISTS "Users can update their claimed teams" ON tournament_teams;

CREATE POLICY "Authenticated users can claim empty player1 slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (player1_name IS NULL OR auth.uid() = player1_user_id)
  WITH CHECK (
    (player1_name IS NOT NULL AND auth.uid() = player1_user_id) OR
    (player2_name IS NOT NULL AND auth.uid() = player2_user_id)
  );

CREATE POLICY "Authenticated users can claim empty player2 slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (player2_name IS NULL OR auth.uid() = player2_user_id)
  WITH CHECK (
    (player1_name IS NOT NULL AND auth.uid() = player1_user_id) OR
    (player2_name IS NOT NULL AND auth.uid() = player2_user_id)
  );

CREATE POLICY "Users can update their own player slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = player1_user_id OR auth.uid() = player2_user_id)
  WITH CHECK (auth.uid() = player1_user_id OR auth.uid() = player2_user_id);

CREATE INDEX IF NOT EXISTS idx_tournament_teams_player1_user ON tournament_teams(player1_user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_player2_user ON tournament_teams(player2_user_id);
