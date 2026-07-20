/*
  # Fix Teams Player Foreign Keys
  
  1. Changes
    - Drop existing foreign key constraints for player3_id and player4_id that reference profiles table
    - Add new foreign key constraints for player3_id and player4_id that reference players table
    
  2. Purpose
    - Ensure consistency: all 4 player slots now reference the players table
    - Fix the roster display issue where player3 and player4 were not showing up
    
  3. Notes
    - This makes all player references consistent within the teams table
    - Existing data integrity is maintained (player3_id and player4_id are currently NULL)
*/

-- Drop existing foreign key constraints for player3 and player4
ALTER TABLE teams 
  DROP CONSTRAINT IF EXISTS teams_player3_id_fkey;

ALTER TABLE teams 
  DROP CONSTRAINT IF EXISTS teams_player4_id_fkey;

-- Add new foreign key constraints that reference players table
ALTER TABLE teams 
  ADD CONSTRAINT teams_player3_id_fkey 
  FOREIGN KEY (player3_id) 
  REFERENCES players(id) 
  ON DELETE SET NULL;

ALTER TABLE teams 
  ADD CONSTRAINT teams_player4_id_fkey 
  FOREIGN KEY (player4_id) 
  REFERENCES players(id) 
  ON DELETE SET NULL;