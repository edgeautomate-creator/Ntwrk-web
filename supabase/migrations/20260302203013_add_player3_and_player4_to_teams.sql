/*
  # Add player3_id and player4_id to teams table

  1. Changes
    - Add `player3_id` column to teams table (nullable uuid, foreign key to profiles)
    - Add `player4_id` column to teams table (nullable uuid, foreign key to profiles)
    - Add indexes for the new foreign key columns for performance

  2. Purpose
    - Support teams with up to 4 players in league play
    - Maintain referential integrity with profiles table
*/

-- Add player3_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'player3_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN player3_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add player4_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'player4_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN player4_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for the new foreign key columns
CREATE INDEX IF NOT EXISTS idx_teams_player3_id ON teams(player3_id);
CREATE INDEX IF NOT EXISTS idx_teams_player4_id ON teams(player4_id);
