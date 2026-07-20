/*
  # Add DUPR Club Support to Pickup Sessions and Leagues

  1. Changes to pickup_sessions
    - Add `dupr_club_id` (text) - DUPR club identifier for posting matches
    - Add `dupr_club_name` (text) - Display name of the DUPR club
  
  2. Changes to seasons (for leagues)
    - Add `dupr_club_id` (text) - DUPR club identifier for posting matches
    - Add `dupr_club_name` (text) - Display name of the DUPR club
  
  3. Purpose
    - Allow users to select their DUPR club when creating pickup sessions or leagues
    - Enable automatic posting of match results to DUPR
    - Mirror the functionality available in tournaments
*/

-- Add DUPR club columns to pickup_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_sessions' AND column_name = 'dupr_club_id'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN dupr_club_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_sessions' AND column_name = 'dupr_club_name'
  ) THEN
    ALTER TABLE pickup_sessions ADD COLUMN dupr_club_name text;
  END IF;
END $$;

-- Add DUPR club columns to seasons (for leagues)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'dupr_club_id'
  ) THEN
    ALTER TABLE seasons ADD COLUMN dupr_club_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'dupr_club_name'
  ) THEN
    ALTER TABLE seasons ADD COLUMN dupr_club_name text;
  END IF;
END $$;