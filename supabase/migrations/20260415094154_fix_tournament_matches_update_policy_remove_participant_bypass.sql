/*
  # Fix tournament_matches UPDATE policies - remove participant bypass

  ## Problem
  Two conflicting UPDATE policies exist on tournament_matches:
  1. "Score update: DUPR club director/organizer or tournament creator" (restrictive, correct)
  2. "Participants can update their match scores" (too permissive - any participant in
     any match can update scores, bypassing DUPR club role checks entirely)

  Because RLS policies are combined with OR, any authenticated user who is a
  participant in a match can update its scores, regardless of tournament type or
  DUPR club membership.

  ## Fix
  Drop the "Participants can update their match scores" policy so that only:
  - Non-DUPR tournaments: the tournament creator can update match scores
  - DUPR tournaments: a director or organizer of the tournament's linked DUPR club
    can update match scores

  The director/organizer check joins profiles -> user_dupr_clubs using dupr_id,
  which is the same source of truth used by the dupr-user-clubs edge function.

  ## Security
  - No anonymous access
  - Participants can no longer directly write scores — this must go through
    an authorized user (creator or DUPR club director/organizer)
  - The remaining "Score update: DUPR club director/organizer or tournament creator"
    policy already covers all legitimate update paths
*/

DROP POLICY IF EXISTS "Participants can update their match scores" ON tournament_matches;
DROP POLICY IF EXISTS "Participants can update matches" ON tournament_matches;
