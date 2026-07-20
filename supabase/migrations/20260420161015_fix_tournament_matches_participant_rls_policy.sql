/*
  # Fix Tournament Matches RLS Policy — Participant Score Update

  ## Problem
  The existing UPDATE policy checks `player1_id = auth.uid()` but player1_id through
  player4_id store a `session_player_id` (tournament_teams.id UUID), never an auth UUID.
  This means participant score submissions were silently blocked by RLS.

  ## Fix
  Replace the broken participant check with a join through tournament_teams so we resolve
  the session_player_id back to the auth user via player1_user_id / player2_user_id.

  ## Changes
  - Drops: "Score update: creator, DUPR director/organizer, or match participant"
  - Creates: same policy name with corrected participant USING + WITH CHECK clauses
*/

DROP POLICY IF EXISTS "Score update: creator, DUPR director/organizer, or match participant" ON tournament_matches;

CREATE POLICY "Score update: creator, DUPR director/organizer, or match participant"
  ON tournament_matches
  FOR UPDATE
  TO authenticated
  USING (
    -- Tournament creator
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
    -- Team format: participant linked via tournament_teams player user IDs
    OR EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE (tt.id = tournament_matches.team1_id OR tt.id = tournament_matches.team2_id)
        AND (tt.player1_user_id = auth.uid() OR tt.player2_user_id = auth.uid())
    )
    -- Individual / King of the Hill format: player1_id..player4_id hold tournament_teams.id
    -- (the session_player_id), so join back through tournament_teams to resolve auth user
    OR EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE tt.id IN (
        tournament_matches.player1_id,
        tournament_matches.player2_id,
        tournament_matches.player3_id,
        tournament_matches.player4_id
      )
        AND (tt.player1_user_id = auth.uid() OR tt.player2_user_id = auth.uid())
    )
  )
  WITH CHECK (
    -- Tournament creator / DUPR club director/organizer
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
    -- Team format participant
    OR EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE (tt.id = tournament_matches.team1_id OR tt.id = tournament_matches.team2_id)
        AND (tt.player1_user_id = auth.uid() OR tt.player2_user_id = auth.uid())
    )
    -- Individual format: resolve session_player_id → auth user via tournament_teams
    OR EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE tt.id IN (
        tournament_matches.player1_id,
        tournament_matches.player2_id,
        tournament_matches.player3_id,
        tournament_matches.player4_id
      )
        AND (tt.player1_user_id = auth.uid() OR tt.player2_user_id = auth.uid())
    )
  );
