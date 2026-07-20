/*
  # Restructure Leagues System - Remove Divisions (v2)

  ## Overview
  This migration restructures the league system to remove divisions entirely.
  Teams now belong directly to seasons, and we add format (singles/doubles) to determine team composition.

  ## Changes

  ### 1. Seasons Table Updates
  - Add `format` column ('singles' or 'doubles') to determine if teams have 1 or 2 players
  - Add `max_teams` column (moved from divisions)
  
  ### 2. Teams Table Updates
  - Remove `division_id` dependency (keep column for backward compatibility)
  - Add `season_id` to link teams to seasons
  - Make `player2_id` nullable (for singles format)

  ### 3. Other Tables
  - Add `season_id` to matches, standings, player_stats, pair_stats
  - Update all triggers and functions to work with season_id

  ## Security
  - Update RLS policies to work with season_id instead of division_id
*/

-- ============================================================================
-- STEP 1: DROP PROBLEMATIC TRIGGERS FIRST
-- ============================================================================

DROP TRIGGER IF EXISTS recalculate_stats_on_match_change ON matches;
DROP TRIGGER IF EXISTS recalculate_stats_on_game_change ON games;
DROP TRIGGER IF EXISTS trigger_update_standings ON matches;

DROP FUNCTION IF EXISTS trigger_recalculate_stats() CASCADE;
DROP FUNCTION IF EXISTS recalculate_standings_for_division(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_standings() CASCADE;

-- ============================================================================
-- STEP 2: UPDATE SEASONS TABLE
-- ============================================================================

ALTER TABLE seasons 
ADD COLUMN IF NOT EXISTS format text DEFAULT 'doubles';

ALTER TABLE seasons 
ADD COLUMN IF NOT EXISTS max_teams integer;

-- Add constraint for format if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'seasons_format_check'
  ) THEN
    ALTER TABLE seasons 
    ADD CONSTRAINT seasons_format_check 
    CHECK (format IN ('singles', 'doubles'));
  END IF;
END $$;

-- ============================================================================
-- STEP 3: UPDATE TEAMS TABLE
-- ============================================================================

ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS season_id uuid;

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'teams_season_id_fkey'
  ) THEN
    ALTER TABLE teams 
    ADD CONSTRAINT teams_season_id_fkey 
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing teams: copy division's season_id to team's season_id
UPDATE teams 
SET season_id = divisions.season_id 
FROM divisions 
WHERE teams.division_id = divisions.id 
AND teams.season_id IS NULL;

-- Make player2_id nullable for singles format
ALTER TABLE teams 
ALTER COLUMN player2_id DROP NOT NULL;

-- ============================================================================
-- STEP 4: UPDATE MATCHES TABLE
-- ============================================================================

ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS season_id uuid;

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matches_season_id_fkey'
  ) THEN
    ALTER TABLE matches 
    ADD CONSTRAINT matches_season_id_fkey 
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing matches
UPDATE matches 
SET season_id = divisions.season_id 
FROM divisions 
WHERE matches.division_id = divisions.id 
AND matches.season_id IS NULL;

-- ============================================================================
-- STEP 5: UPDATE STANDINGS TABLE
-- ============================================================================

ALTER TABLE standings 
ADD COLUMN IF NOT EXISTS season_id uuid;

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'standings_season_id_fkey'
  ) THEN
    ALTER TABLE standings 
    ADD CONSTRAINT standings_season_id_fkey 
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing standings
UPDATE standings 
SET season_id = divisions.season_id 
FROM divisions 
WHERE standings.division_id = divisions.id 
AND standings.season_id IS NULL;

-- ============================================================================
-- STEP 6: UPDATE PLAYER_STATS TABLE
-- ============================================================================

ALTER TABLE player_stats 
ADD COLUMN IF NOT EXISTS season_id uuid;

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_stats_season_id_fkey'
  ) THEN
    ALTER TABLE player_stats 
    ADD CONSTRAINT player_stats_season_id_fkey 
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing player_stats
UPDATE player_stats 
SET season_id = divisions.season_id 
FROM divisions 
WHERE player_stats.division_id = divisions.id 
AND player_stats.season_id IS NULL;

-- ============================================================================
-- STEP 7: UPDATE PAIR_STATS TABLE
-- ============================================================================

ALTER TABLE pair_stats 
ADD COLUMN IF NOT EXISTS season_id uuid;

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pair_stats_season_id_fkey'
  ) THEN
    ALTER TABLE pair_stats 
    ADD CONSTRAINT pair_stats_season_id_fkey 
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing pair_stats
UPDATE pair_stats 
SET season_id = divisions.season_id 
FROM divisions 
WHERE pair_stats.division_id = divisions.id 
AND pair_stats.season_id IS NULL;

-- ============================================================================
-- STEP 8: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams(season_id);
CREATE INDEX IF NOT EXISTS idx_matches_season_id ON matches(season_id);
CREATE INDEX IF NOT EXISTS idx_standings_season_id ON standings(season_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_season_id ON player_stats(season_id);
CREATE INDEX IF NOT EXISTS idx_pair_stats_season_id ON pair_stats(season_id);

-- ============================================================================
-- STEP 9: UPDATE RLS POLICIES FOR TEAMS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view teams in their org divisions" ON teams;
DROP POLICY IF EXISTS "Users can view teams in their org seasons" ON teams;
DROP POLICY IF EXISTS "Org admins can manage teams" ON teams;
DROP POLICY IF EXISTS "Team members can view their team" ON teams;
DROP POLICY IF EXISTS "Org members can create teams" ON teams;
DROP POLICY IF EXISTS "Team captains and org admins can update teams" ON teams;
DROP POLICY IF EXISTS "Org admins can delete teams" ON teams;

CREATE POLICY "Users can view teams in their org"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = teams.organization_id
    )
  );

CREATE POLICY "Org members can create teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = teams.organization_id
    )
  );

CREATE POLICY "Team captains and org admins can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (
    teams.captain_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = teams.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  )
  WITH CHECK (
    teams.captain_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = teams.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  );

CREATE POLICY "Org admins can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = teams.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  );

-- ============================================================================
-- STEP 10: UPDATE RLS POLICIES FOR MATCHES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view matches in their org divisions" ON matches;
DROP POLICY IF EXISTS "Users can view matches in their org seasons" ON matches;
DROP POLICY IF EXISTS "Users can view matches in their org" ON matches;
DROP POLICY IF EXISTS "Team members can view their matches" ON matches;
DROP POLICY IF EXISTS "Org admins can manage matches" ON matches;

CREATE POLICY "Users can view matches in their org"
  ON matches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = matches.organization_id
    )
  );

CREATE POLICY "Org admins can manage matches"
  ON matches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = matches.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = matches.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  );

-- ============================================================================
-- STEP 11: UPDATE RLS POLICIES FOR STANDINGS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view standings in their org divisions" ON standings;
DROP POLICY IF EXISTS "Users can view standings in their org seasons" ON standings;
DROP POLICY IF EXISTS "Users can view standings in their org" ON standings;
DROP POLICY IF EXISTS "System can manage standings" ON standings;

CREATE POLICY "Users can view standings in their org"
  ON standings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = standings.organization_id
    )
  );

CREATE POLICY "System can manage standings"
  ON standings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = standings.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = standings.organization_id
        AND user_roles.role IN ('org_admin', 'league_director')
    )
  );

-- ============================================================================
-- STEP 12: UPDATE RLS POLICIES FOR PLAYER_STATS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view player stats in their org divisions" ON player_stats;
DROP POLICY IF EXISTS "Users can view player stats in their org seasons" ON player_stats;
DROP POLICY IF EXISTS "Users can view player stats in their org" ON player_stats;

CREATE POLICY "Users can view player stats in their org"
  ON player_stats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = player_stats.organization_id
    )
  );

-- ============================================================================
-- STEP 13: UPDATE RLS POLICIES FOR PAIR_STATS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view pair stats in their org divisions" ON pair_stats;
DROP POLICY IF EXISTS "Users can view pair stats in their org seasons" ON pair_stats;
DROP POLICY IF EXISTS "Users can view pair stats in their org" ON pair_stats;

CREATE POLICY "Users can view pair stats in their org"
  ON pair_stats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = pair_stats.organization_id
    )
  );

-- ============================================================================
-- STEP 14: ADD UNIQUE CONSTRAINT FOR STANDINGS
-- ============================================================================

ALTER TABLE standings DROP CONSTRAINT IF EXISTS standings_division_team_unique;
ALTER TABLE standings DROP CONSTRAINT IF EXISTS standings_season_team_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'standings_season_team_unique'
  ) THEN
    ALTER TABLE standings 
    ADD CONSTRAINT standings_season_team_unique 
    UNIQUE (season_id, team_id);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;
