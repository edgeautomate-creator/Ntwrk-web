/*
  # Make standings.division_id nullable
  
  ## Overview
  The divisions system was removed from the application, but the standings table
  still has a required division_id column. This migration makes it nullable to
  allow league creation without divisions.
  
  ## Changes
  1. Make division_id nullable in standings table
  2. Update any NOT NULL constraints
  3. Ensure existing data remains intact
  
  ## Impact
  - New leagues can be created without specifying a division_id
  - Existing standings with division_id values are preserved
  - League standings will be grouped by season_id instead of division_id
  
  ## Security
  - No RLS policy changes needed
  - Existing policies continue to work with nullable division_id
*/

-- Make division_id nullable in the standings table
ALTER TABLE standings 
ALTER COLUMN division_id DROP NOT NULL;
