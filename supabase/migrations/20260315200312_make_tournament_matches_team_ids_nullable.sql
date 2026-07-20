/*
  # Make team1_id and team2_id nullable in tournament_matches

  1. Changes
    - Remove NOT NULL constraint from `team1_id` column in `tournament_matches`
    - Remove NOT NULL constraint from `team2_id` column in `tournament_matches`
    
  2. Reason
    - Allows King of the Hill format to store individual player relationships
    - Uses player1_id, player2_id, player3_id, player4_id columns instead of team references
    - Maintains backwards compatibility with existing team-based tournament formats
    
  3. Impact
    - King of the Hill doubles matches can now be created without placeholder teams
    - Existing matches with team IDs continue to work normally
    - Foreign key constraints remain but allow null values
*/

-- Make team1_id nullable
ALTER TABLE tournament_matches 
ALTER COLUMN team1_id DROP NOT NULL;

-- Make team2_id nullable
ALTER TABLE tournament_matches 
ALTER COLUMN team2_id DROP NOT NULL;
