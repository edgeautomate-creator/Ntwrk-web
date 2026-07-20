/*
  # Add Best Of Format to Seasons
  
  1. Changes
    - Add `best_of` column to seasons table to store match format (1, 3, or 5 games)
    
  2. Security
    - Existing RLS policies continue to apply
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'best_of'
  ) THEN
    ALTER TABLE seasons ADD COLUMN best_of integer DEFAULT 3 CHECK (best_of IN (1, 3, 5));
  END IF;
END $$;
