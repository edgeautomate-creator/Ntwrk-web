/*
  # Make expected_teams nullable for King of the Hill tournaments

  1. Changes
    - Alter `tournaments` table to make `expected_teams` column nullable
    - This allows King of the Hill tournaments to have NULL for expected_teams
    - King of the Hill tournaments use `player_capacity` instead of team-based structure
  
  2. Reasoning
    - King of the Hill format doesn't use teams, only individual players
    - Setting expected_teams to NULL is semantically correct for this format
    - Existing tournament records retain their values
*/

ALTER TABLE tournaments 
ALTER COLUMN expected_teams DROP NOT NULL;
