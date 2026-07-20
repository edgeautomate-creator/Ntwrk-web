/*
  # Update RLS Policies for Score Confirmation System

  ## Summary
  Extends the tournament_matches UPDATE policy to allow participants (players in
  a match) to submit scores. Participant-submitted scores will be set to
  is_score_confirmed = false by the application layer, requiring creator or
  director/organizer to confirm.

  ## Changes

  ### Policy Updates on tournament_matches
  - Drops the existing single-policy and replaces it with one that also allows
    participants in the specific match to update scores
  - Participants: users linked via tournament_teams.player1_user_id or player2_user_id
    for team formats, or via player1_id...player4_id for individual (King of Hill) format
  - Confirmation column (is_score_confirmed) can be set to true ONLY by the tournament
    creator or DUPR club director/organizer — enforced by application logic; the RLS
    allows the update to the row but the app controls which fields are sent

  ## Security
  - auth.uid() used throughout
  - Authenticated users only
  - Participants can only update matches they are playing in
  - Creators and DUPR club directors/organizers can update any match in their tournament
*/

DROP POLICY IF EXISTS "Score update: tournament creator or DUPR club director/organizer" ON tournament_matches;

CREATE POLICY "Score update: creator, DUPR director/organizer, or match participant"
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
    OR
    EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE (tt.id = tournament_matches.team1_id OR tt.id = tournament_matches.team2_id)
        AND (tt.player1_user_id = auth.uid() OR tt.player2_user_id = auth.uid())
    )
    OR (
      tournament_matches.player1_id = auth.uid()
      OR tournament_matches.player2_id = auth.uid()
      OR tournament_matches.player3_id = auth.uid()
      OR tournament_matches.player4_id = auth.uid()
    )
  )
  WITH CHECK (
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
    OR
    EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE (tt.id = tournament_matches.team1_id OR tt.id = tournament_matches.team2_id)
        AND (tt.player1_user_id = auth.uid() OR tt.player2_user_id = auth.uid())
    )
    OR (
      tournament_matches.player1_id = auth.uid()
      OR tournament_matches.player2_id = auth.uid()
      OR tournament_matches.player3_id = auth.uid()
      OR tournament_matches.player4_id = auth.uid()
    )
  );
