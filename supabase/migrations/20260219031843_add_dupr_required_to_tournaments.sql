/*
  # Add DUPR requirement option to tournaments

  1. Changes
    - Add `is_dupr_required` column to `tournaments` table
      - Boolean field, defaults to false
      - When true, only users with DUPR IDs in their profiles can claim teams
  
  2. Notes
    - This allows tournament organizers to control whether participants need DUPR accounts
    - Provides flexibility for both casual and competitive tournaments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'is_dupr_required'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN is_dupr_required boolean DEFAULT false;
  END IF;
END $$;