/*
  # Allow Manual Players Without Accounts

  1. Changes
    - Make `user_id` nullable in `pickup_session_players` table
    - This allows organizers to add players without requiring them to have accounts
    - Useful for casual pickup games where players just want to play without app registration
  
  2. Security
    - Still maintains RLS policies
    - Only session creators can add manual players
    - Manual players can't update their own status (no account = no auth.uid())
  
  3. Notes
    - For DUPR-rated sessions, players must have accounts and DUPR IDs
    - For non-DUPR sessions, manual player names can be added
*/

-- Drop the existing unique constraint
ALTER TABLE pickup_session_players 
  DROP CONSTRAINT IF EXISTS pickup_session_players_session_id_user_id_key;

-- Make user_id nullable for manual player entries
ALTER TABLE pickup_session_players 
  ALTER COLUMN user_id DROP NOT NULL;

-- Create a unique index that allows multiple NULL user_ids but ensures unique combinations
CREATE UNIQUE INDEX IF NOT EXISTS idx_pickup_session_players_unique_account
  ON pickup_session_players(session_id, user_id)
  WHERE user_id IS NOT NULL;

-- Ensure unique player names per session for manual entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_pickup_session_players_unique_manual
  ON pickup_session_players(session_id, LOWER(player_name))
  WHERE user_id IS NULL;