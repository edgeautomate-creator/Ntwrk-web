/*
  # Add date and time fields to pickup sessions

  1. Changes
    - Add `session_date` (date) column to pickup_sessions table
    - Add `session_time` (time) column to pickup_sessions table
    - Both fields are optional to allow flexibility in scheduling
  
  2. Notes
    - These fields are optional and allow organizers to specify when the pickup session will occur
    - Separate date and time fields provide better flexibility for display and filtering
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_sessions' AND column_name = 'session_date'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN session_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_sessions' AND column_name = 'session_time'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN session_time time;
  END IF;
END $$;