/*
  # Recalculate All Team Standings From Scratch

  ## Summary
  Due to the double-counting bug in the previous standings trigger, existing
  team_standings rows may have inflated win/loss/points values. This migration
  clears all standings and rebuilds them from the actual completed match data,
  excluding playoff matches.

  ## What It Does
  1. Deletes all existing team_standings rows
  2. Rebuilds standings by aggregating all completed, non-playoff tournament matches
*/

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
  SELECT
    tournament_id,
    team1_id AS team_id,
    CASE WHEN team1_games_won > team2_games_won THEN 1 ELSE 0 END AS games_won,
    CASE WHEN team2_games_won > team1_games_won THEN 1 ELSE 0 END AS games_lost,
    COALESCE(team1_games_won, 0) AS points_for,
    COALESCE(team2_games_won, 0) AS points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team1_id IS NOT NULL
    AND team1_games_won IS NOT NULL
    AND team2_games_won IS NOT NULL
    AND (is_playoff_match IS NULL OR is_playoff_match = false)

  UNION ALL

  SELECT
    tournament_id,
    team2_id AS team_id,
    CASE WHEN team2_games_won > team1_games_won THEN 1 ELSE 0 END AS games_won,
    CASE WHEN team1_games_won > team2_games_won THEN 1 ELSE 0 END AS games_lost,
    COALESCE(team2_games_won, 0) AS points_for,
    COALESCE(team1_games_won, 0) AS points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team2_id IS NOT NULL
    AND team1_games_won IS NOT NULL
    AND team2_games_won IS NOT NULL
    AND (is_playoff_match IS NULL OR is_playoff_match = false)
) AS combined
GROUP BY tournament_id, team_id;
