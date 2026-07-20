/*
  # Add Score Columns to Matches Table

  1. Changes
    - Add team1_score and team2_score columns to matches table
    - These will store the individual game scores for each match
    
  2. Security
    - No RLS changes needed - existing policies cover these columns
*/

-- Add score columns to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS team1_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS team2_score integer DEFAULT 0;
