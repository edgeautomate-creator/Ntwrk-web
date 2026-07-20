-- Add DUPR match tracking to tournament_matches for create/update club match sync
-- dupr_match_id: numeric ID from DUPR create response; used for GET and update
-- dupr_match_identifier: unique string we send as "identifier" and reuse on update
ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS dupr_match_id bigint,
  ADD COLUMN IF NOT EXISTS dupr_match_identifier text;

COMMENT ON COLUMN tournament_matches.dupr_match_id IS 'DUPR API match id; used for GET /match/v1.0/{id} and update';
COMMENT ON COLUMN tournament_matches.dupr_match_identifier IS 'Unique identifier sent to DUPR create/update; stored for reuse';
