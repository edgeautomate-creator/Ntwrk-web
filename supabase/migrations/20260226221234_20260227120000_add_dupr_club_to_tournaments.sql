/*
  # Add DUPR club columns to tournaments

  - Add `dupr_club_id` (text, nullable) – DUPR club id from the API
  - Add `dupr_club_name` (text, nullable) – Club name for display
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'dupr_club_id'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN dupr_club_id text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'dupr_club_name'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN dupr_club_name text;
  END IF;
END $$;