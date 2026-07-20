/*
  # Fix Teams Schema - Make player1_id Nullable
  
  1. Changes
    - Make `teams.player1_id` nullable to allow creating empty teams
    - Teams in leagues start without players assigned
    - Players are added through the `team_players` table after team creation
  
  2. Reasoning
    - Leagues create teams first, then players join later
    - The current NOT NULL constraint on `player1_id` prevents league creation
    - This aligns with the `team_players` table structure for player management
*/

-- Make player1_id nullable
ALTER TABLE teams ALTER COLUMN player1_id DROP NOT NULL;
