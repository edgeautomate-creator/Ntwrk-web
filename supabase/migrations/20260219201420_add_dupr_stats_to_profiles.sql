/*
  # Add comprehensive DUPR statistics to profiles

  1. Changes
    - Add `dupr_singles_rating` (numeric, nullable) - User's DUPR singles rating
    - Add `dupr_doubles_rating` (numeric, nullable) - User's DUPR doubles rating (rename existing dupr_rating)
    - Add `dupr_singles_wins` (integer, nullable) - Total singles wins
    - Add `dupr_singles_losses` (integer, nullable) - Total singles losses
    - Add `dupr_doubles_wins` (integer, nullable) - Total doubles wins
    - Add `dupr_doubles_losses` (integer, nullable) - Total doubles losses
    - Add `dupr_data` (jsonb, nullable) - Store complete DUPR API response for future use

  2. Notes
    - Keeps existing dupr_rating column for backwards compatibility
    - New columns provide detailed performance tracking
    - JSONB column allows storing full API response without schema changes
*/

-- Add new DUPR statistics columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_singles_rating'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_singles_rating numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_doubles_rating'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_doubles_rating numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_singles_wins'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_singles_wins integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_singles_losses'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_singles_losses integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_doubles_wins'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_doubles_wins integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_doubles_losses'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_doubles_losses integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_data'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_data jsonb;
  END IF;
END $$;