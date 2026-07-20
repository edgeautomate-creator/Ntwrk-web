/*
  # Backfill Pickup Session Player Ratings

  1. Purpose
    - Update existing pickup_session_players records to have correct DUPR ratings
    - Use singles rating for singles sessions, doubles rating for doubles sessions
    - Only updates players who have a user_id (linked accounts) and are missing ratings

  2. Changes
    - Updates pickup_session_players.dupr_rating from profiles table
    - Uses session format to determine which rating to use
    - Preserves existing ratings if already set

  3. Security
    - No RLS changes, this is a data update only
*/

-- Update pickup session players with correct ratings based on session format
UPDATE pickup_session_players
SET dupr_rating = CASE 
  WHEN ps.format = 'singles' THEN p.dupr_singles_rating
  ELSE p.dupr_doubles_rating
END
FROM pickup_sessions ps, profiles p
WHERE pickup_session_players.session_id = ps.id
  AND pickup_session_players.user_id = p.id
  AND pickup_session_players.user_id IS NOT NULL
  AND pickup_session_players.dupr_rating IS NULL
  AND pickup_session_players.status = 'active';
