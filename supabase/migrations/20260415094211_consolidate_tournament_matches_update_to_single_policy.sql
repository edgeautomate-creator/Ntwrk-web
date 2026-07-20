/*
  # Consolidate tournament_matches UPDATE to a single authoritative policy

  ## Problem
  Two UPDATE policies exist after the previous fix:
  1. "Creators can update matches" — allows any tournament creator to update ANY match
     in their tournament, regardless of whether it's a DUPR tournament. This means a
     creator who is NOT a DUPR club director/organizer can still submit scores for
     DUPR tournaments, bypassing the intended gating.
  2. "Score update: DUPR club director/organizer or tournament creator" — the correct
     policy that distinguishes DUPR vs non-DUPR cases.

  Because these are combined with OR, the broader "Creators can update matches" policy
  wins for all tournament creators, nullifying the DUPR club role restriction.

  ## Fix
  Drop "Creators can update matches" so only the single authoritative policy remains:
  - Non-DUPR tournament: tournament creator can update scores
  - DUPR tournament with a linked club: only a director or organizer of that DUPR
    club can update scores (verified by joining profiles -> user_dupr_clubs via dupr_id)

  ## Security
  - auth.uid() used throughout
  - No anonymous access
  - Single policy, no OR-bypass possible
*/

DROP POLICY IF EXISTS "Creators can update matches" ON tournament_matches;
