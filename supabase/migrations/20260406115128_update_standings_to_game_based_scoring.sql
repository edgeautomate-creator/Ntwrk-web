/*
  # Update Standings to Game-Based Scoring

  1. Changes
    - Updates the update_team_standings_from_match() trigger function
    - Changes standings calculation from match-based to game-based scoring
    - Now tracks individual games won/lost instead of matches won/lost
    - In best-of-3: winner can get 2-3 games, loser can get 0-1 games
    - In best-of-5: winner can get 3-5 games, loser can get 0-2 games
    
  2. Impact
    - The 'wins' column in team_standings now represents games won (not matches)
    - The 'losses' column in team_standings now represents games lost (not matches)
    - Provides more granular scoring that rewards every game won
    - Better reflects performance in close matches (2-1 vs 2-0 now matters)
    
  3. Data Migration
    - Recalculates all existing team_standings based on individual games
    - Uses team1_games_won and team2_games_won from tournament_matches
    
  4. Security
    - No security changes, only calculation logic updates
*/

-- Drop and recreate the trigger function with game-based scoring
CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.team1_score IS NOT NULL AND NEW.team2_score IS NOT NULL THEN
    -- Only set winner if not already set (by calculate_match_scores_trigger)
    IF NEW.winner_team_id IS NULL THEN
      IF NEW.team1_games_won > NEW.team2_games_won THEN
        NEW.winner_team_id := NEW.team1_id;
      ELSIF NEW.team2_games_won > NEW.team1_games_won THEN
        NEW.winner_team_id := NEW.team2_id;
      END IF;
    END IF;

    -- Set completed timestamp if not already set
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;

    -- Update standings for team 1 - using GAMES WON/LOST instead of match wins/losses
    INSERT INTO team_standings (
      tournament_id, 
      team_id, 
      matches_played, 
      wins,  -- Now represents GAMES won
      losses,  -- Now represents GAMES lost
      points_for, 
      points_against, 
      point_differential
    )
    VALUES (
      NEW.tournament_id,
      NEW.team1_id,
      1,
      COALESCE(NEW.team1_games_won, 0),  -- Add games won by team 1
      COALESCE(NEW.team2_games_won, 0),  -- Add games lost by team 1 (opponent's games won)
      NEW.team1_score,
      NEW.team2_score,
      NEW.team1_score - NEW.team2_score
    )
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + COALESCE(NEW.team1_games_won, 0),  -- Accumulate games won
      losses = team_standings.losses + COALESCE(NEW.team2_games_won, 0),  -- Accumulate games lost
      points_for = team_standings.points_for + NEW.team1_score,
      points_against = team_standings.points_against + NEW.team2_score,
      point_differential = team_standings.point_differential + (NEW.team1_score - NEW.team2_score),
      updated_at = now();

    -- Update standings for team 2 - using GAMES WON/LOST instead of match wins/losses
    INSERT INTO team_standings (
      tournament_id, 
      team_id, 
      matches_played, 
      wins,  -- Now represents GAMES won
      losses,  -- Now represents GAMES lost
      points_for, 
      points_against, 
      point_differential
    )
    VALUES (
      NEW.tournament_id,
      NEW.team2_id,
      1,
      COALESCE(NEW.team2_games_won, 0),  -- Add games won by team 2
      COALESCE(NEW.team1_games_won, 0),  -- Add games lost by team 2 (opponent's games won)
      NEW.team2_score,
      NEW.team1_score,
      NEW.team2_score - NEW.team1_score
    )
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + COALESCE(NEW.team2_games_won, 0),  -- Accumulate games won
      losses = team_standings.losses + COALESCE(NEW.team1_games_won, 0),  -- Accumulate games lost
      points_for = team_standings.points_for + NEW.team2_score,
      points_against = team_standings.points_against + NEW.team1_score,
      point_differential = team_standings.point_differential + (NEW.team2_score - NEW.team1_score),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Recalculate all existing team standings based on game-based scoring
-- First, clear all existing standings
TRUNCATE TABLE team_standings;

-- Recalculate standings from all completed matches
INSERT INTO team_standings (
  tournament_id,
  team_id,
  matches_played,
  wins,
  losses,
  points_for,
  points_against,
  point_differential
)
SELECT
  tournament_id,
  team_id,
  COUNT(*) as matches_played,
  SUM(games_won) as wins,
  SUM(games_lost) as losses,
  SUM(points_for) as points_for,
  SUM(points_against) as points_against,
  SUM(points_for - points_against) as point_differential
FROM (
  -- Team 1 perspective
  SELECT
    tournament_id,
    team1_id as team_id,
    COALESCE(team1_games_won, 0) as games_won,
    COALESCE(team2_games_won, 0) as games_lost,
    team1_score as points_for,
    team2_score as points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team1_id IS NOT NULL
    AND team1_score IS NOT NULL
    AND team2_score IS NOT NULL
    AND is_playoff_match = false
  
  UNION ALL
  
  -- Team 2 perspective
  SELECT
    tournament_id,
    team2_id as team_id,
    COALESCE(team2_games_won, 0) as games_won,
    COALESCE(team1_games_won, 0) as games_lost,
    team2_score as points_for,
    team1_score as points_against
  FROM tournament_matches
  WHERE status = 'completed'
    AND team2_id IS NOT NULL
    AND team1_score IS NOT NULL
    AND team2_score IS NOT NULL
    AND is_playoff_match = false
) combined_stats
GROUP BY tournament_id, team_id;
