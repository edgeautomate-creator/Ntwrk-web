/*
  # Make playoff_teams nullable for King of the Hill tournaments

  1. Changes
    - Alter `tournaments.playoff_teams` column to be nullable
    
  2. Reasoning
    - King of the Hill tournaments use `playoff_qualifiers` instead of `playoff_teams`
    - The application sets `playoff_teams` to NULL for King of the Hill format
    - This column should only be required for traditional bracket tournaments (round_robin, group_stage_playoffs)
    
  3. Security
    - No RLS changes needed
    - Existing constraints and indexes remain intact
*/

-- Make playoff_teams nullable to support King of the Hill tournaments
ALTER TABLE tournaments 
  ALTER COLUMN playoff_teams DROP NOT NULL;
