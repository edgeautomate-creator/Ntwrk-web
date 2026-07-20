/*
  # Add DUPR Match Tracking to Pickup Matchups and League Matches

  1. Changes to pickup_matchups
    - Add `dupr_match_id` (integer) - DUPR's internal match ID
    - Add `dupr_match_identifier` (text) - DUPR's match identifier string
  
  2. Changes to matches (league matches)
    - Add `dupr_match_id` (integer) - DUPR's internal match ID
    - Add `dupr_match_identifier` (text) - DUPR's match identifier string
  
  3. Purpose
    - Track which local matches have been synced to DUPR
    - Enable future updates or deletions of DUPR matches
    - Provide audit trail of DUPR synchronization
*/

-- Add DUPR match tracking columns to pickup_matchups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_matchups' AND column_name = 'dupr_match_id'
  ) THEN
    ALTER TABLE pickup_matchups ADD COLUMN dupr_match_id integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_matchups' AND column_name = 'dupr_match_identifier'
  ) THEN
    ALTER TABLE pickup_matchups ADD COLUMN dupr_match_identifier text;
  END IF;
END $$;

-- Add DUPR match tracking columns to matches (league matches)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'dupr_match_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN dupr_match_id integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'dupr_match_identifier'
  ) THEN
    ALTER TABLE matches ADD COLUMN dupr_match_identifier text;
  END IF;
END $$;