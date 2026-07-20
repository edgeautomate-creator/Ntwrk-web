/*
  # Fix Standings: Use Actual Game Scores for PF/PA

  ## Summary
  Previously, `points_for` and `points_against` in `team_standings` were storing
  the count of *games won/lost* within a match (e.g. 2 or 1 in a best-of-3).
  They should instead store the sum of actual *point scores* across all games
  (e.g. 11+9=20 total points scored by a team across both games played).

  ## Changes

  ### Modified Tables
  - `team_standings`
    - `points_for`: now accumulates sum of all actual game points scored by the team
    - `points_against`: now accumulates sum of all actual game points scored by the opponent
    - `point_differential`: now `points_for - points_against` using actual scores
    - `wins` / `losses`: unchanged — still match-level win/loss counts

  ### Modified Functions
  - `update_team_standings_from_match()`: updated to sum game1..game5 actual points
    for each team instead of using `team1_games_won` / `team2_games_won`

  ### Data Recalculation
  - All existing `team_standings` rows are deleted and rebuilt from scratch
    using actual game point totals from `game1_team1_points` through `game5_team2_points`

  ## Notes
  1. A game's points are only counted if BOTH teams have a non-null score for that game
     (same rule used when determining games won)
  2. Wins/losses remain based on games won comparison — only PF/PA source changes
*/

CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER AS $$
DECLARE
  v_team1_wins INTEGER := 0;
  v_team1_losses INTEGER := 0;
  v_team2_wins INTEGER := 0;
  v_team2_losses INTEGER := 0;
  v_old_team1_wins INTEGER := 0;
  v_old_team1_losses INTEGER := 0;
  v_old_team2_wins INTEGER := 0;
  v_old_team2_losses INTEGER := 0;
  -- Actual score totals (sum of all game points)
  v_team1_points_for INTEGER := 0;
  v_team1_points_against INTEGER := 0;
  v_team2_points_for INTEGER := 0;
  v_team2_points_against INTEGER := 0;
  v_old_team1_points_for INTEGER := 0;
  v_old_team1_points_against INTEGER := 0;
  v_old_team2_points_for INTEGER := 0;
  v_old_team2_points_against INTEGER := 0;
BEGIN
  -- Skip playoff matches entirely
  IF NEW.is_playoff_match = true THEN
    RETURN NEW;
  END IF;

  -- If this is an UPDATE and the match was already completed, subtract the old values first
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed'
     AND OLD.team1_games_won IS NOT NULL AND OLD.team2_games_won IS NOT NULL THEN

    -- Determine old wins/losses
    IF OLD.team1_games_won > OLD.team2_games_won THEN
      v_old_team1_wins := 1;
      v_old_team2_losses := 1;
    ELSIF OLD.team2_games_won > OLD.team1_games_won THEN
      v_old_team2_wins := 1;
      v_old_team1_losses := 1;
    END IF;

    -- Sum old actual game scores for team 1 (only count games where both teams have scores)
    v_old_team1_points_for :=
      CASE WHEN OLD.game1_team1_points IS NOT NULL AND OLD.game1_team2_points IS NOT NULL THEN COALESCE(OLD.game1_team1_points, 0) ELSE 0 END +
      CASE WHEN OLD.game2_team1_points IS NOT NULL AND OLD.game2_team2_points IS NOT NULL THEN COALESCE(OLD.game2_team1_points, 0) ELSE 0 END +
      CASE WHEN OLD.game3_team1_points IS NOT NULL AND OLD.game3_team2_points IS NOT NULL THEN COALESCE(OLD.game3_team1_points, 0) ELSE 0 END +
      CASE WHEN OLD.game4_team1_points IS NOT NULL AND OLD.game4_team2_points IS NOT NULL THEN COALESCE(OLD.game4_team1_points, 0) ELSE 0 END +
      CASE WHEN OLD.game5_team1_points IS NOT NULL AND OLD.game5_team2_points IS NOT NULL THEN COALESCE(OLD.game5_team1_points, 0) ELSE 0 END;

    v_old_team1_points_against :=
      CASE WHEN OLD.game1_team1_points IS NOT NULL AND OLD.game1_team2_points IS NOT NULL THEN COALESCE(OLD.game1_team2_points, 0) ELSE 0 END +
      CASE WHEN OLD.game2_team1_points IS NOT NULL AND OLD.game2_team2_points IS NOT NULL THEN COALESCE(OLD.game2_team2_points, 0) ELSE 0 END +
      CASE WHEN OLD.game3_team1_points IS NOT NULL AND OLD.game3_team2_points IS NOT NULL THEN COALESCE(OLD.game3_team2_points, 0) ELSE 0 END +
      CASE WHEN OLD.game4_team1_points IS NOT NULL AND OLD.game4_team2_points IS NOT NULL THEN COALESCE(OLD.game4_team2_points, 0) ELSE 0 END +
      CASE WHEN OLD.game5_team1_points IS NOT NULL AND OLD.game5_team2_points IS NOT NULL THEN COALESCE(OLD.game5_team2_points, 0) ELSE 0 END;

    v_old_team2_points_for := v_old_team1_points_against;
    v_old_team2_points_against := v_old_team1_points_for;

    -- Subtract old values from team 1
    IF OLD.team1_id IS NOT NULL THEN
      UPDATE team_standings SET
        matches_played = GREATEST(0, matches_played - 1),
        wins = GREATEST(0, wins - v_old_team1_wins),
        losses = GREATEST(0, losses - v_old_team1_losses),
        points_for = GREATEST(0, points_for - v_old_team1_points_for),
        points_against = GREATEST(0, points_against - v_old_team1_points_against),
        point_differential = point_differential - (v_old_team1_points_for - v_old_team1_points_against),
        updated_at = now()
      WHERE tournament_id = OLD.tournament_id AND team_id = OLD.team1_id;
    END IF;

    -- Subtract old values from team 2
    IF OLD.team2_id IS NOT NULL THEN
      UPDATE team_standings SET
        matches_played = GREATEST(0, matches_played - 1),
        wins = GREATEST(0, wins - v_old_team2_wins),
        losses = GREATEST(0, losses - v_old_team2_losses),
        points_for = GREATEST(0, points_for - v_old_team2_points_for),
        points_against = GREATEST(0, points_against - v_old_team2_points_against),
        point_differential = point_differential - (v_old_team2_points_for - v_old_team2_points_against),
        updated_at = now()
      WHERE tournament_id = OLD.tournament_id AND team_id = OLD.team2_id;
    END IF;

  END IF;

  -- Now add the new values if the match is completed
  IF NEW.status = 'completed'
     AND NEW.team1_games_won IS NOT NULL
     AND NEW.team2_games_won IS NOT NULL THEN

    -- Determine new wins/losses
    IF NEW.team1_games_won > NEW.team2_games_won THEN
      v_team1_wins := 1;
      v_team2_losses := 1;
    ELSIF NEW.team2_games_won > NEW.team1_games_won THEN
      v_team2_wins := 1;
      v_team1_losses := 1;
    END IF;

    -- Sum new actual game scores for team 1
    v_team1_points_for :=
      CASE WHEN NEW.game1_team1_points IS NOT NULL AND NEW.game1_team2_points IS NOT NULL THEN COALESCE(NEW.game1_team1_points, 0) ELSE 0 END +
      CASE WHEN NEW.game2_team1_points IS NOT NULL AND NEW.game2_team2_points IS NOT NULL THEN COALESCE(NEW.game2_team1_points, 0) ELSE 0 END +
      CASE WHEN NEW.game3_team1_points IS NOT NULL AND NEW.game3_team2_points IS NOT NULL THEN COALESCE(NEW.game3_team1_points, 0) ELSE 0 END +
      CASE WHEN NEW.game4_team1_points IS NOT NULL AND NEW.game4_team2_points IS NOT NULL THEN COALESCE(NEW.game4_team1_points, 0) ELSE 0 END +
      CASE WHEN NEW.game5_team1_points IS NOT NULL AND NEW.game5_team2_points IS NOT NULL THEN COALESCE(NEW.game5_team1_points, 0) ELSE 0 END;

    v_team1_points_against :=
      CASE WHEN NEW.game1_team1_points IS NOT NULL AND NEW.game1_team2_points IS NOT NULL THEN COALESCE(NEW.game1_team2_points, 0) ELSE 0 END +
      CASE WHEN NEW.game2_team1_points IS NOT NULL AND NEW.game2_team2_points IS NOT NULL THEN COALESCE(NEW.game2_team2_points, 0) ELSE 0 END +
      CASE WHEN NEW.game3_team1_points IS NOT NULL AND NEW.game3_team2_points IS NOT NULL THEN COALESCE(NEW.game3_team2_points, 0) ELSE 0 END +
      CASE WHEN NEW.game4_team1_points IS NOT NULL AND NEW.game4_team2_points IS NOT NULL THEN COALESCE(NEW.game4_team2_points, 0) ELSE 0 END +
      CASE WHEN NEW.game5_team1_points IS NOT NULL AND NEW.game5_team2_points IS NOT NULL THEN COALESCE(NEW.game5_team2_points, 0) ELSE 0 END;

    v_team2_points_for := v_team1_points_against;
    v_team2_points_against := v_team1_points_for;

    -- Upsert standings for team 1
    IF NEW.team1_id IS NOT NULL THEN
      INSERT INTO team_standings (
        id, tournament_id, team_id,
        matches_played, wins, losses,
        points_for, points_against, point_differential
      ) VALUES (
        gen_random_uuid(), NEW.tournament_id, NEW.team1_id,
        1, v_team1_wins, v_team1_losses,
        v_team1_points_for,
        v_team1_points_against,
        v_team1_points_for - v_team1_points_against
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        matches_played = team_standings.matches_played + 1,
        wins = team_standings.wins + v_team1_wins,
        losses = team_standings.losses + v_team1_losses,
        points_for = team_standings.points_for + v_team1_points_for,
        points_against = team_standings.points_against + v_team1_points_against,
        point_differential = team_standings.point_differential + (v_team1_points_for - v_team1_points_against),
        updated_at = now();
    END IF;

    -- Upsert standings for team 2
    IF NEW.team2_id IS NOT NULL THEN
      INSERT INTO team_standings (
        id, tournament_id, team_id,
        matches_played, wins, losses,
        points_for, points_against, point_differential
      ) VALUES (
        gen_random_uuid(), NEW.tournament_id, NEW.team2_id,
        1, v_team2_wins, v_team2_losses,
        v_team2_points_for,
        v_team2_points_against,
        v_team2_points_for - v_team2_points_against
      )
      ON CONFLICT (tournament_id, team_id) DO UPDATE SET
        matches_played = team_standings.matches_played + 1,
        wins = team_standings.wins + v_team2_wins,
        losses = team_standings.losses + v_team2_losses,
        points_for = team_standings.points_for + v_team2_points_for,
        points_against = team_standings.points_against + v_team2_points_against,
        point_differential = team_standings.point_differential + (v_team2_points_for - v_team2_points_against),
        updated_at = now();
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is still in place
DROP TRIGGER IF EXISTS trigger_update_team_standings ON tournament_matches;

CREATE TRIGGER trigger_update_team_standings
  AFTER INSERT OR UPDATE OF status, team1_games_won, team2_games_won, team1_id, team2_id,
    game1_team1_points, game1_team2_points,
    game2_team1_points, game2_team2_points,
    game3_team1_points, game3_team2_points,
    game4_team1_points, game4_team2_points,
    game5_team1_points, game5_team2_points
  ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_team_standings_from_match();

-- Recalculate all existing standings from scratch using actual game scores
DELETE FROM team_standings;

INSERT INTO team_standings (
  id, tournament_id, team_id,
  matches_played, wins, losses,
  points_for, points_against, point_differential
)
SELECT
  gen_random_uuid(),
  tournament_id,
  team_id,
  COUNT(*) AS matches_played,
  SUM(games_won) AS wins,
  SUM(games_lost) AS losses,
  SUM(points_for) AS points_for,
  SUM(points_against) AS points_against,
  SUM(points_for - points_against) AS point_differential
FROM (
  -- Team 1 perspective
  SELECT
    tournament_id,
    team1_id AS team_id,
    CASE WHEN team1_games_won > team2_games_won THEN 1 ELSE 0 END AS games_won,
    CASE WHEN team2_games_won > team1_games_won THEN 1 ELSE 0 END AS games_lost,
    (
      CASE WHEN game1_team1_points IS NOT NULL AND game1_team2_points IS NOT NULL THEN COALESCE(game1_team1_points, 0) ELSE 0 END +
      CASE WHEN game2_team1_points IS NOT NULL AND game2_team2_points IS NOT NULL THEN COALESCE(game2_team1_points, 0) ELSE 0 END +
      CASE WHEN game3_team1_points IS NOT NULL AND game3_team2_points IS NOT NULL THEN COALESCE(game3_team1_points, 0) ELSE 0 END +
      CASE WHEN game4_team1_points IS NOT NULL AND game4_team2_points IS NOT NULL THEN COALESCE(game4_team1_points, 0) ELSE 0 END +
      CASE WHEN game5_team1_points IS NOT NULL AND game5_team2_points IS NOT NULL THEN COALESCE(game5_team1_points, 0) ELSE 0 END
    ) AS points_for,
    (
      CASE WHEN game1_team1_points IS NOT NULL AND game1_team2_points IS NOT NULL THEN COALESCE(game1_team2_points, 0) ELSE 0 END +
      CASE WHEN game2_team1_points IS NOT NULL AND game2_team2_points IS NOT NULL THEN COALESCE(game2_team2_points, 0) ELSE 0 END +
      CASE WHEN game3_team1_points IS NOT NULL AND game3_team2_points IS NOT NULL THEN COALESCE(game3_team2_points, 0) ELSE 0 END +
      CASE WHEN game4_team1_points IS NOT NULL AND game4_team2_points IS NOT NULL THEN COALESCE(game4_team2_points, 0) ELSE 0 END +
      CASE WHEN game5_team1_points IS NOT NULL AND game5_team2_points IS NOT NULL THEN COALESCE(game5_team2_points, 0) ELSE 0 END
    ) AS points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team1_id IS NOT NULL
    AND team1_games_won IS NOT NULL
    AND team2_games_won IS NOT NULL
    AND (is_playoff_match IS NULL OR is_playoff_match = false)

  UNION ALL

  -- Team 2 perspective
  SELECT
    tournament_id,
    team2_id AS team_id,
    CASE WHEN team2_games_won > team1_games_won THEN 1 ELSE 0 END AS games_won,
    CASE WHEN team1_games_won > team2_games_won THEN 1 ELSE 0 END AS games_lost,
    (
      CASE WHEN game1_team1_points IS NOT NULL AND game1_team2_points IS NOT NULL THEN COALESCE(game1_team2_points, 0) ELSE 0 END +
      CASE WHEN game2_team1_points IS NOT NULL AND game2_team2_points IS NOT NULL THEN COALESCE(game2_team2_points, 0) ELSE 0 END +
      CASE WHEN game3_team1_points IS NOT NULL AND game3_team2_points IS NOT NULL THEN COALESCE(game3_team2_points, 0) ELSE 0 END +
      CASE WHEN game4_team1_points IS NOT NULL AND game4_team2_points IS NOT NULL THEN COALESCE(game4_team2_points, 0) ELSE 0 END +
      CASE WHEN game5_team1_points IS NOT NULL AND game5_team2_points IS NOT NULL THEN COALESCE(game5_team2_points, 0) ELSE 0 END
    ) AS points_for,
    (
      CASE WHEN game1_team1_points IS NOT NULL AND game1_team2_points IS NOT NULL THEN COALESCE(game1_team1_points, 0) ELSE 0 END +
      CASE WHEN game2_team1_points IS NOT NULL AND game2_team2_points IS NOT NULL THEN COALESCE(game2_team1_points, 0) ELSE 0 END +
      CASE WHEN game3_team1_points IS NOT NULL AND game3_team2_points IS NOT NULL THEN COALESCE(game3_team1_points, 0) ELSE 0 END +
      CASE WHEN game4_team1_points IS NOT NULL AND game4_team2_points IS NOT NULL THEN COALESCE(game4_team1_points, 0) ELSE 0 END +
      CASE WHEN game5_team1_points IS NOT NULL AND game5_team2_points IS NOT NULL THEN COALESCE(game5_team1_points, 0) ELSE 0 END
    ) AS points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team2_id IS NOT NULL
    AND team1_games_won IS NOT NULL
    AND team2_games_won IS NOT NULL
    AND (is_playoff_match IS NULL OR is_playoff_match = false)
) AS combined
GROUP BY tournament_id, team_id;
