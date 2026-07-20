/*
  # Integrate Tournament Teams User Tracking
  
  1. Schema Changes
    - Add player1_user_id and player2_user_id columns to track linked user accounts
    - Add foreign key constraints to profiles table
    - Add indexes for performance
  
  2. Policy Updates
    - Drop old policies that don't match the new schema
    - Add comprehensive policies for team slot claiming and updates
    - Allow users to claim slots and update their own teams
    - Maintain tournament creator full control
  
  3. Security
    - Users can claim empty slots (player1_name or player2_name is NULL)
    - Users can update teams where they are a player
    - Tournament creators can update any teams in their tournaments
*/

-- Add user tracking columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_teams' AND column_name = 'player1_user_id'
  ) THEN
    ALTER TABLE tournament_teams 
    ADD COLUMN player1_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_teams' AND column_name = 'player2_user_id'
  ) THEN
    ALTER TABLE tournament_teams 
    ADD COLUMN player2_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_tournament_teams_player1_user_id 
  ON tournament_teams(player1_user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_player2_user_id 
  ON tournament_teams(player2_user_id);

-- Drop old policies that will be replaced
DROP POLICY IF EXISTS "Authenticated users can claim empty team slots" ON tournament_teams;
DROP POLICY IF EXISTS "Users can update their claimed teams" ON tournament_teams;

-- Create new policy for users to claim slots or update their teams
CREATE POLICY "Users can claim slots or update their teams"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (
    -- Can update if any slot is empty OR if they're one of the players
    player1_name IS NULL 
    OR player2_name IS NULL
    OR auth.uid() = player1_user_id
    OR auth.uid() = player2_user_id
  )
  WITH CHECK (
    -- After update, they must be one of the players
    auth.uid() = player1_user_id
    OR auth.uid() = player2_user_id
  );
