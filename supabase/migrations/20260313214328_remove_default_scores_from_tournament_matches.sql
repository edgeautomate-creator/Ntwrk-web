/*
  # Remove Default Values from Tournament Match Scores

  1. Changes
    - Remove DEFAULT 0 from team1_score column
    - Remove DEFAULT 0 from team2_score column
    - Scores should be NULL until explicitly set
  
  2. Reasoning
    - Having DEFAULT 0 causes confusion between "no score entered" vs "actual score of 0"
    - NULL properly represents "score not yet entered"
    - Prevents accidental 0-0 scores from appearing
*/

-- Remove default values from score columns
ALTER TABLE tournament_matches 
  ALTER COLUMN team1_score DROP DEFAULT,
  ALTER COLUMN team2_score DROP DEFAULT;
