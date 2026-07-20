/*
  # Drop Tournament Teams Claim Policy

  1. Changes
    - Drop "Users can claim slots or update their teams" policy from tournament_teams table
    - Removes ability for authenticated users to update tournament team slots

  2. Security
    - Tournament team updates will now be restricted unless other policies exist
*/

DROP POLICY IF EXISTS "Users can claim slots or update their teams" ON tournament_teams;
