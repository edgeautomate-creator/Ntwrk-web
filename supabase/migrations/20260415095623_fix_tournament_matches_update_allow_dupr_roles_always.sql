/*
  # Fix tournament_matches UPDATE policy to always allow DUPR club directors/organizers

  ## Problem
  The existing policy only allows DUPR club director/organizer access when
  `is_dupr_required = true`. For non-DUPR tournaments that still have a linked
  `dupr_club_id`, directors and organizers of that club are incorrectly blocked
  from updating match scores.

  ## Fix
  Rebuild the UPDATE policy so that for ANY tournament:
  - The tournament creator can always update scores
  - A director or organizer of the tournament's linked DUPR club (if any) can
    always update scores, regardless of `is_dupr_required`

  ## Security
  - auth.uid() used throughout
  - Authenticated users only
  - No participant bypass
  - Single policy, no OR-bypass possible
*/

DROP POLICY IF EXISTS "Score update: DUPR club director/organizer or tournament creato" ON tournament_matches;

CREATE POLICY "Score update: tournament creator or DUPR club director/organizer"
  ON tournament_matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
        AND (
          t.created_by = auth.uid()
          OR (
            t.dupr_club_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM profiles p
              JOIN user_dupr_clubs udc ON udc.dupr_id = p.dupr_id
              WHERE p.id = auth.uid()
                AND udc.dupr_club_id = t.dupr_club_id
                AND lower(udc.user_role) IN ('director', 'organizer')
            )
          )
        )
    )
  );
