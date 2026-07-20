/*
  # Remove rotation_required column from seasons table

  1. Changes
    - Drop `rotation_required` column from `seasons` table
    
  2. Reason
    - This feature is unused and being removed from the application
    - The column was never implemented beyond storage
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'seasons' AND column_name = 'rotation_required'
  ) THEN
    ALTER TABLE seasons DROP COLUMN rotation_required;
  END IF;
END $$;
