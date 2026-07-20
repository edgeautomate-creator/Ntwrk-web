/*
  # Backfill Player Counts for Existing Tournaments

  1. Purpose
    - Calculate and set registered_players_count for all existing tournaments
    - Ensures data consistency before triggers take over

  2. Logic
    - For each tournament, calculates count based on format:
      - round_robin_individual: Counts individual filled player slots
      - Team singles: Counts teams with player1_name filled
      - Team doubles: Counts teams with both players filled
    
  3. Notes
    - This is a one-time migration to initialize existing data
    - Future changes will be handled automatically by triggers
*/

-- Backfill player counts for all existing tournaments
UPDATE tournaments t
SET registered_players_count = (
  CASE
    -- For individual tournaments, count each filled player slot
    WHEN t.format = 'round_robin_individual' OR t.registration_type = 'individual' THEN (
      SELECT COALESCE(SUM(
        (CASE WHEN tt.player1_name IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN tt.player2_name IS NOT NULL THEN 1 ELSE 0 END)
      ), 0)::integer
      FROM tournament_teams tt
      WHERE tt.tournament_id = t.id
    )
    -- For singles team tournaments, count teams with player1 filled
    WHEN t.team_format = 'singles' THEN (
      SELECT COUNT(*)::integer
      FROM tournament_teams tt
      WHERE tt.tournament_id = t.id
      AND tt.player1_name IS NOT NULL
    )
    -- For doubles team tournaments, count teams with both players filled
    ELSE (
      SELECT COUNT(*)::integer
      FROM tournament_teams tt
      WHERE tt.tournament_id = t.id
      AND tt.player1_name IS NOT NULL
      AND tt.player2_name IS NOT NULL
    )
  END
)
WHERE EXISTS (
  SELECT 1 FROM tournament_teams tt WHERE tt.tournament_id = t.id
);
