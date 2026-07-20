/*
  # Add Team Captains and Enhanced Standings System

  ## Overview
  This migration adds captain tracking to teams and enhances the standings system
  with a comprehensive four-tier ranking system: total points, wins, game wins, and point differential.

  ## Changes

  ### 1. Teams Table Enhancements
    - `captain_user_id` (uuid, foreign key) - User designated as team captain
    - Captain has special permissions to submit lineups and manage team

  ### 2. Standings Table Enhancements
    - `game_wins` (integer) - Number of individual games won (for tiebreaker)
    - `total_points` (integer) - Sum of all points scored across all games
    - Standings are sorted by: total_points DESC, wins DESC, game_wins DESC, point_differential DESC

  ### 3. Matches Table Enhancements
    - `is_playoff` (boolean, default false) - Marks playoff matches (excluded from regular season standings)

  ### 4. Security
    - Team captains get special RLS permissions for lineup management
    - Division participants linked to teams automatically update their role to 'captain'

  ### 5. Indexes
    - Index on captain_user_id for captain queries
    - Composite index on (division_id, total_points, wins) for standings queries
*/

-- Add captain to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS captain_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for captain lookups
CREATE INDEX IF NOT EXISTS idx_teams_captain_user_id ON teams(captain_user_id);

-- Add enhanced columns to standings table
ALTER TABLE standings 
ADD COLUMN IF NOT EXISTS game_wins integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points integer DEFAULT 0;

-- Rename points_for to be clearer (total_points is sum of ALL game points)
-- points_for already exists and represents match points
-- total_points will be the sum of all individual game scores

-- Add is_playoff to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS is_playoff boolean DEFAULT false;

-- Add index for playoff filtering
CREATE INDEX IF NOT EXISTS idx_matches_is_playoff ON matches(is_playoff);
CREATE INDEX IF NOT EXISTS idx_matches_division_playoff ON matches(division_id, is_playoff);

-- Add composite index for standings queries
CREATE INDEX IF NOT EXISTS idx_standings_division_ranking ON standings(division_id, total_points DESC, wins DESC, game_wins DESC, point_differential DESC);

-- Function to sync division participant role when captain is assigned
CREATE OR REPLACE FUNCTION sync_team_captain_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If captain is being assigned
  IF NEW.captain_user_id IS NOT NULL AND (OLD.captain_user_id IS NULL OR OLD.captain_user_id != NEW.captain_user_id) THEN
    -- Update the new captain's division participant role
    UPDATE division_participants
    SET role = 'captain', team_id = NEW.id
    WHERE user_id = NEW.captain_user_id
    AND division_id = NEW.division_id;
    
    -- If there was an old captain, demote them to participant
    IF OLD.captain_user_id IS NOT NULL AND OLD.captain_user_id != NEW.captain_user_id THEN
      UPDATE division_participants
      SET role = 'participant'
      WHERE user_id = OLD.captain_user_id
      AND division_id = NEW.division_id
      AND role = 'captain';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_team_captain_role ON teams;
CREATE TRIGGER trigger_sync_team_captain_role
  AFTER INSERT OR UPDATE OF captain_user_id ON teams
  FOR EACH ROW
  EXECUTE FUNCTION sync_team_captain_role();

-- Function to calculate enhanced standings after match completion
CREATE OR REPLACE FUNCTION update_enhanced_standings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team1_game_wins integer := 0;
  v_team2_game_wins integer := 0;
  v_team1_total_points integer := 0;
  v_team2_total_points integer := 0;
  v_team1_points_for integer := 0;
  v_team2_points_for integer := 0;
  v_team1_points_against integer := 0;
  v_team2_points_against integer := 0;
BEGIN
  -- Only update if match is completed and not a playoff match
  IF NEW.status = 'approved' AND NEW.winner_team_id IS NOT NULL AND (NEW.is_playoff IS NULL OR NEW.is_playoff = false) THEN
    
    -- Calculate game wins and total points from games table
    SELECT 
      COALESCE(SUM(CASE WHEN winner_team_id = NEW.team1_id THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN winner_team_id = NEW.team2_id THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(team1_score), 0),
      COALESCE(SUM(team2_score), 0)
    INTO 
      v_team1_game_wins,
      v_team2_game_wins,
      v_team1_total_points,
      v_team2_total_points
    FROM games
    WHERE match_id = NEW.id;
    
    -- Calculate cumulative stats for team1 from ALL their non-playoff matches
    SELECT 
      COALESCE(SUM(CASE 
        WHEN m.id = NEW.id THEN v_team1_total_points
        WHEN m.team1_id = NEW.team1_id THEN (SELECT COALESCE(SUM(team1_score), 0) FROM games WHERE match_id = m.id)
        ELSE (SELECT COALESCE(SUM(team2_score), 0) FROM games WHERE match_id = m.id)
      END), 0),
      COALESCE(SUM(CASE 
        WHEN m.id = NEW.id THEN v_team2_total_points
        WHEN m.team1_id = NEW.team1_id THEN (SELECT COALESCE(SUM(team2_score), 0) FROM games WHERE match_id = m.id)
        ELSE (SELECT COALESCE(SUM(team1_score), 0) FROM games WHERE match_id = m.id)
      END), 0)
    INTO v_team1_points_for, v_team1_points_against
    FROM matches m
    WHERE (m.team1_id = NEW.team1_id OR m.team2_id = NEW.team1_id)
    AND m.status = 'approved'
    AND m.winner_team_id IS NOT NULL
    AND (m.is_playoff IS NULL OR m.is_playoff = false)
    AND m.division_id = NEW.division_id;
    
    -- Calculate cumulative stats for team2 from ALL their non-playoff matches
    SELECT 
      COALESCE(SUM(CASE 
        WHEN m.id = NEW.id THEN v_team2_total_points
        WHEN m.team1_id = NEW.team2_id THEN (SELECT COALESCE(SUM(team1_score), 0) FROM games WHERE match_id = m.id)
        ELSE (SELECT COALESCE(SUM(team2_score), 0) FROM games WHERE match_id = m.id)
      END), 0),
      COALESCE(SUM(CASE 
        WHEN m.id = NEW.id THEN v_team1_total_points
        WHEN m.team1_id = NEW.team2_id THEN (SELECT COALESCE(SUM(team2_score), 0) FROM games WHERE match_id = m.id)
        ELSE (SELECT COALESCE(SUM(team1_score), 0) FROM games WHERE match_id = m.id)
      END), 0)
    INTO v_team2_points_for, v_team2_points_against
    FROM matches m
    WHERE (m.team1_id = NEW.team2_id OR m.team2_id = NEW.team2_id)
    AND m.status = 'approved'
    AND m.winner_team_id IS NOT NULL
    AND (m.is_playoff IS NULL OR m.is_playoff = false)
    AND m.division_id = NEW.division_id;
    
    -- Update or insert team1 standings
    INSERT INTO standings (
      division_id,
      team_id,
      organization_id,
      wins,
      losses,
      game_wins,
      total_points,
      points_for,
      points_against,
      point_differential,
      matches_played,
      win_percentage
    )
    VALUES (
      NEW.division_id,
      NEW.team1_id,
      NEW.organization_id,
      CASE WHEN NEW.winner_team_id = NEW.team1_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_team_id = NEW.team2_id THEN 1 ELSE 0 END,
      v_team1_game_wins,
      v_team1_points_for,
      v_team1_points_for,
      v_team1_points_against,
      v_team1_points_for - v_team1_points_against,
      1,
      CASE WHEN NEW.winner_team_id = NEW.team1_id THEN 1.0 ELSE 0.0 END
    )
    ON CONFLICT (division_id, team_id, organization_id)
    DO UPDATE SET
      wins = standings.wins + CASE WHEN NEW.winner_team_id = NEW.team1_id THEN 1 ELSE 0 END,
      losses = standings.losses + CASE WHEN NEW.winner_team_id = NEW.team2_id THEN 1 ELSE 0 END,
      game_wins = v_team1_game_wins,
      total_points = v_team1_points_for,
      points_for = v_team1_points_for,
      points_against = v_team1_points_against,
      point_differential = v_team1_points_for - v_team1_points_against,
      matches_played = standings.matches_played + 1,
      win_percentage = CASE 
        WHEN standings.matches_played + 1 > 0 
        THEN (standings.wins + CASE WHEN NEW.winner_team_id = NEW.team1_id THEN 1 ELSE 0 END)::numeric / (standings.matches_played + 1)::numeric
        ELSE 0 
      END,
      updated_at = now();
    
    -- Update or insert team2 standings
    INSERT INTO standings (
      division_id,
      team_id,
      organization_id,
      wins,
      losses,
      game_wins,
      total_points,
      points_for,
      points_against,
      point_differential,
      matches_played,
      win_percentage
    )
    VALUES (
      NEW.division_id,
      NEW.team2_id,
      NEW.organization_id,
      CASE WHEN NEW.winner_team_id = NEW.team2_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_team_id = NEW.team1_id THEN 1 ELSE 0 END,
      v_team2_game_wins,
      v_team2_points_for,
      v_team2_points_for,
      v_team2_points_against,
      v_team2_points_for - v_team2_points_against,
      1,
      CASE WHEN NEW.winner_team_id = NEW.team2_id THEN 1.0 ELSE 0.0 END
    )
    ON CONFLICT (division_id, team_id, organization_id)
    DO UPDATE SET
      wins = standings.wins + CASE WHEN NEW.winner_team_id = NEW.team2_id THEN 1 ELSE 0 END,
      losses = standings.losses + CASE WHEN NEW.winner_team_id = NEW.team1_id THEN 1 ELSE 0 END,
      game_wins = v_team2_game_wins,
      total_points = v_team2_points_for,
      points_for = v_team2_points_for,
      points_against = v_team2_points_against,
      point_differential = v_team2_points_for - v_team2_points_against,
      matches_played = standings.matches_played + 1,
      win_percentage = CASE 
        WHEN standings.matches_played + 1 > 0 
        THEN (standings.wins + CASE WHEN NEW.winner_team_id = NEW.team2_id THEN 1 ELSE 0 END)::numeric / (standings.matches_played + 1)::numeric
        ELSE 0 
      END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger for enhanced standings
DROP TRIGGER IF EXISTS trigger_update_standings ON matches;
CREATE TRIGGER trigger_update_standings
  AFTER UPDATE OF status, winner_team_id ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_enhanced_standings();
