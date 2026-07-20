/*
  # Add Player IDs to Pickup Matchups

  1. Changes
    - Add player_id fields to `pickup_matchups` table to reference `pickup_session_players.id`
    - This allows us to properly track both account-based and manual players in matchups
    - Keep existing user_id fields for backwards compatibility

  2. New Fields
    - `player_a_id` (uuid, references pickup_session_players.id)
    - `player_b_id` (uuid, references pickup_session_players.id)
    - `team1_player1_id` (uuid, references pickup_session_players.id)
    - `team1_player2_id` (uuid, references pickup_session_players.id)
    - `team2_player1_id` (uuid, references pickup_session_players.id)
    - `team2_player2_id` (uuid, references pickup_session_players.id)

  3. Notes
    - These fields provide a reliable way to identify players in matchups
    - Manual players (user_id IS NULL) can now be properly tracked
    - Frontend should use these player_id fields instead of user_id for lookups
*/

-- Add player_id fields for singles format
ALTER TABLE pickup_matchups 
  ADD COLUMN IF NOT EXISTS player_a_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS player_b_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL;

-- Add player_id fields for doubles format
ALTER TABLE pickup_matchups 
  ADD COLUMN IF NOT EXISTS team1_player1_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team1_player2_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team2_player1_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team2_player2_id uuid REFERENCES pickup_session_players(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_a_id ON pickup_matchups(player_a_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_b_id ON pickup_matchups(player_b_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player1_id ON pickup_matchups(team1_player1_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player2_id ON pickup_matchups(team1_player2_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player1_id ON pickup_matchups(team2_player1_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player2_id ON pickup_matchups(team2_player2_id);
