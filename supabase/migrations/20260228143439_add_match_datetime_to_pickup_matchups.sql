/*
  # Add match date/time to pickup matchups

  1. Changes
    - Add `match_datetime` column to `pickup_matchups` table
      - Type: timestamptz (timestamp with timezone)
      - Optional field for recording when a match was played
      - Defaults to NULL (not required)
    
    - Add `match_datetime` column to `pickup_playoff_matchups` table
      - Type: timestamptz (timestamp with timezone)
      - Optional field for recording when a playoff match was played
      - Defaults to NULL (not required)

  2. Notes
    - This allows users to optionally record when matches were played
    - Useful for tracking match history and scheduling
    - Not required - users can leave it blank if they don't want to track timing
*/

-- Add match_datetime to pickup_matchups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_matchups' AND column_name = 'match_datetime'
  ) THEN
    ALTER TABLE pickup_matchups ADD COLUMN match_datetime timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add match_datetime to pickup_playoff_matchups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_playoff_matchups' AND column_name = 'match_datetime'
  ) THEN
    ALTER TABLE pickup_playoff_matchups ADD COLUMN match_datetime timestamptz DEFAULT NULL;
  END IF;
END $$;