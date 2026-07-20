/*
  # Add Player Count Tracking to Tournaments

  1. New Column
    - `registered_players_count` (integer, default 0, not null)
      - Automatically tracks the current count of registered players/teams
      - Updated by database triggers on tournament_teams table
      - For round_robin_individual: counts individual filled player slots
      - For team formats (singles): counts teams with player1_name filled
      - For team formats (doubles): counts teams with both players filled

  2. Changes
    - Add registered_players_count column to tournaments table
    - Column defaults to 0 for new tournaments
    - Triggers will maintain this count automatically

  3. Benefits
    - Eliminates need for manual player counting in frontend
    - Improves performance by avoiding COUNT queries
    - Ensures consistent player counts across application
    - Automatically handles player registration, removal, and withdrawals
*/

-- Add registered_players_count column to tournaments table
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS registered_players_count integer NOT NULL DEFAULT 0 
CHECK (registered_players_count >= 0);

COMMENT ON COLUMN tournaments.registered_players_count IS 'Automatically maintained count of registered players or teams. Updated by triggers on tournament_teams table.';
