/*
  Guard deletion of tournaments, pickup sessions, and leagues based on scores.

  Rules:
  - Tournament creator can delete a tournament ONLY if no matches have recorded scores.
  - Pickup session creator can delete a session ONLY if no matchups (regular or playoff) have recorded scores.
  - League creator can delete a league ONLY if no team_matchups in any of its seasons have recorded results.
  - League creator can delete a season under the same "no scores" condition.
*/

-- 1. Ensure leagues table has a created_by column and backfill it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'leagues'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE leagues
      ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Backfill created_by for existing leagues where possible:
-- pick an org admin in the same organization when created_by is NULL.
UPDATE leagues
SET created_by = (
  SELECT user_id
  FROM user_roles
  WHERE user_roles.organization_id = leagues.organization_id
    AND user_roles.role = 'org_admin'
  LIMIT 1
)
WHERE created_by IS NULL;

-- 2. Tighten tournament DELETE policy: creator only, and no scored matches
DROP POLICY IF EXISTS "Creators can delete their tournaments" ON tournaments;
DROP POLICY IF EXISTS "Creators can delete tournaments" ON tournaments;
DROP POLICY IF EXISTS "Users can delete tournaments they created" ON tournaments;

CREATE POLICY "Creators can delete tournaments without scores"
  ON tournaments
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM tournament_matches m
      WHERE m.tournament_id = tournaments.id
        AND (
          m.status = 'completed'
          OR m.team1_score IS NOT NULL
          OR m.team2_score IS NOT NULL
        )
    )
  );

-- 3. Add pickup_sessions DELETE policy: creator only, and no scored matchups
DROP POLICY IF EXISTS "Session creators can delete sessions" ON pickup_sessions;

CREATE POLICY "Session creators can delete sessions without scores"
  ON pickup_sessions
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM pickup_matchups m
      WHERE m.session_id = pickup_sessions.id
        AND (
          m.status = 'completed'
          OR m.game1_team1_points IS NOT NULL
          OR m.game1_team2_points IS NOT NULL
          OR m.game2_team1_points IS NOT NULL
          OR m.game2_team2_points IS NOT NULL
          OR m.game3_team1_points IS NOT NULL
          OR m.game3_team2_points IS NOT NULL
          OR m.game4_team1_points IS NOT NULL
          OR m.game4_team2_points IS NOT NULL
          OR m.game5_team1_points IS NOT NULL
          OR m.game5_team2_points IS NOT NULL
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pickup_playoff_matchups pm
      WHERE pm.session_id = pickup_sessions.id
        AND (
          pm.status = 'completed'
          OR pm.game1_team1_points IS NOT NULL
          OR pm.game1_team2_points IS NOT NULL
          OR pm.game2_team1_points IS NOT NULL
          OR pm.game2_team2_points IS NOT NULL
          OR pm.game3_team1_points IS NOT NULL
          OR pm.game3_team2_points IS NOT NULL
          OR pm.game4_team1_points IS NOT NULL
          OR pm.game4_team2_points IS NOT NULL
          OR pm.game5_team1_points IS NOT NULL
          OR pm.game5_team2_points IS NOT NULL
        )
    )
  );

-- 4. League and season DELETE policies based on scores and creator
DROP POLICY IF EXISTS "Org admins can delete leagues" ON leagues;
DROP POLICY IF EXISTS "Org admins can delete seasons" ON seasons;

CREATE POLICY "League creator can delete leagues without scores"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM team_matchups tm
      JOIN league_weeks lw ON lw.id = tm.league_week_id
      JOIN seasons s ON s.id = lw.season_id
      WHERE s.league_id = leagues.id
        AND (
          tm.finalized = true
          OR tm.home_matchup_wins > 0
          OR tm.away_matchup_wins > 0
        )
    )
  );

CREATE POLICY "League creator can delete seasons without scores"
  ON seasons
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM leagues l
      WHERE l.id = seasons.league_id
        AND l.created_by = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM team_matchups tm
      JOIN league_weeks lw ON lw.id = tm.league_week_id
      WHERE lw.season_id = seasons.id
        AND (
          tm.finalized = true
          OR tm.home_matchup_wins > 0
          OR tm.away_matchup_wins > 0
        )
    )
  );

