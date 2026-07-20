/*
  # Add Match Passwords and Tournament Options

  1. Changes to Seasons Table
    - Add `type` column to differentiate between league and tournament
    - Add `has_playoffs` boolean for playoff configuration
    - Add `rounds` integer for tournament rounds
    - Add `auto_generate_schedule` boolean
    
  2. Changes to Matches Table
    - Add `join_password` column for password-protected matches
    - Add `is_public` boolean to control match visibility
    
  3. Changes to Players Table  
    - Add `dupr_access_token` for user's DUPR API access
    - Add `dupr_refresh_token` for token refresh
    - Add `dupr_token_expires_at` for token expiration
    
  4. Security
    - Existing RLS policies continue to apply
    - Tokens are encrypted at rest by Supabase
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'type'
  ) THEN
    ALTER TABLE seasons ADD COLUMN type text DEFAULT 'league' CHECK (type IN ('league', 'tournament'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'has_playoffs'
  ) THEN
    ALTER TABLE seasons ADD COLUMN has_playoffs boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'rounds'
  ) THEN
    ALTER TABLE seasons ADD COLUMN rounds integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'auto_generate_schedule'
  ) THEN
    ALTER TABLE seasons ADD COLUMN auto_generate_schedule boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'join_password'
  ) THEN
    ALTER TABLE matches ADD COLUMN join_password text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE matches ADD COLUMN is_public boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'dupr_access_token'
  ) THEN
    ALTER TABLE players ADD COLUMN dupr_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'dupr_refresh_token'
  ) THEN
    ALTER TABLE players ADD COLUMN dupr_refresh_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'dupr_token_expires_at'
  ) THEN
    ALTER TABLE players ADD COLUMN dupr_token_expires_at timestamptz;
  END IF;
END $$;