/*
  # Allow null player references in tournament_matches

  1. Changes
    - Drop foreign key constraints for player1_id, player2_id, player3_id, player4_id
    - Keep the columns but make them nullable without foreign key constraints
    
  2. Reason
    - King of the Hill format allows manual player entries without user accounts
    - These players don't exist in the profiles table
    - We still want to track player names and DUPR IDs from tournament_participants
    
  3. Impact
    - Manual players can now be added to King of the Hill matches
    - Existing matches with profile references continue to work
    - Application layer will handle player lookups from either profiles or tournament_participants
*/

-- Drop foreign key constraints if they exist
DO $$ 
BEGIN
  -- Drop player1_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tournament_matches_player1_id_fkey'
    AND table_name = 'tournament_matches'
  ) THEN
    ALTER TABLE tournament_matches DROP CONSTRAINT tournament_matches_player1_id_fkey;
  END IF;

  -- Drop player2_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tournament_matches_player2_id_fkey'
    AND table_name = 'tournament_matches'
  ) THEN
    ALTER TABLE tournament_matches DROP CONSTRAINT tournament_matches_player2_id_fkey;
  END IF;

  -- Drop player3_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tournament_matches_player3_id_fkey'
    AND table_name = 'tournament_matches'
  ) THEN
    ALTER TABLE tournament_matches DROP CONSTRAINT tournament_matches_player3_id_fkey;
  END IF;

  -- Drop player4_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tournament_matches_player4_id_fkey'
    AND table_name = 'tournament_matches'
  ) THEN
    ALTER TABLE tournament_matches DROP CONSTRAINT tournament_matches_player4_id_fkey;
  END IF;
END $$;

-- Ensure columns remain nullable
ALTER TABLE tournament_matches 
  ALTER COLUMN player1_id DROP NOT NULL,
  ALTER COLUMN player2_id DROP NOT NULL,
  ALTER COLUMN player3_id DROP NOT NULL,
  ALTER COLUMN player4_id DROP NOT NULL;
