/*
  # Add DUPR Match Tracking to Tournament Matches

  1. New Columns
    - `dupr_match_id` (bigint, nullable) - Numeric ID from DUPR create response; used for GET and update
    - `dupr_match_identifier` (text, nullable) - Unique identifier sent to DUPR create/update; stored for reuse

  2. Purpose
    - Enable syncing tournament matches with DUPR Club Matches
    - Track DUPR match IDs for updates and retrievals
    - Store unique identifiers for match correlation
*/

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS dupr_match_id bigint,
  ADD COLUMN IF NOT EXISTS dupr_match_identifier text;

COMMENT ON COLUMN tournament_matches.dupr_match_id IS 'DUPR API match id; used for GET /match/v1.0/{id} and update';
COMMENT ON COLUMN tournament_matches.dupr_match_identifier IS 'Unique identifier sent to DUPR create/update; stored for reuse';
