/*
  # Enforce Score Edit Permissions by DUPR Club Role

  ## Summary
  Updates the RLS UPDATE policy on tournament_matches so that:
  - For DUPR-required tournaments: only the director or organizer of the tournament's
    linked DUPR club can update match scores.
  - For non-DUPR tournaments: only the tournament creator can update match scores.

  ## Changes
  - Drops existing UPDATE policies on tournament_matches
  - Creates a new restrictive UPDATE policy enforcing the above rules

  ## Notes
  - user_dupr_clubs uses dupr_id (text) not user_id, so we join through profiles
    to resolve auth.uid() -> dupr_id -> user_dupr_clubs

  ## Security
  - Uses auth.uid() throughout
  - Joins profiles -> user_dupr_clubs to verify club director/organizer role
*/

DO $$
BEGIN
  DROP POLICY IF EXISTS "Creators and participants can update matches" ON tournament_matches;
  DROP POLICY IF EXISTS "Tournament creator can update matches" ON tournament_matches;
  DROP POLICY IF EXISTS "Participants can update matches" ON tournament_matches;
  DROP POLICY IF EXISTS "Score submitters can update matches" ON tournament_matches;
  DROP POLICY IF EXISTS "Allow score updates by authorized users" ON tournament_matches;
  DROP POLICY IF EXISTS "Score update: DUPR club director/organizer or tournament creator" ON tournament_matches;
END $$;

CREATE POLICY "Score update: DUPR club director/organizer or tournament creator"
  ON tournament_matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
        AND (
          -- Non-DUPR tournament: only the creator can edit scores
          (
            (t.is_dupr_required = false OR t.is_dupr_required IS NULL)
            AND t.created_by = auth.uid()
          )
          OR
          -- DUPR tournament: director or organizer of the linked club
          (
            t.is_dupr_required = true
            AND t.dupr_club_id IS NOT NULL
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
