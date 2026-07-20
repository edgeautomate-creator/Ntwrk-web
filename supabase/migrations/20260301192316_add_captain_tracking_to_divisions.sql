/*
  # Add Captain Tracking to Divisions Table
  
  1. Changes
    - Add `captain_user_id` column to divisions table to track team captains
    - Captain can be NULL initially (no captain assigned yet)
    - First player to claim captain spot gets the role
  
  2. Security
    - No new RLS policies needed as divisions table already has proper policies
*/

-- Add captain_user_id column to divisions table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'divisions' AND column_name = 'captain_user_id'
  ) THEN
    ALTER TABLE divisions ADD COLUMN captain_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for captain lookups
CREATE INDEX IF NOT EXISTS idx_divisions_captain ON divisions(captain_user_id);