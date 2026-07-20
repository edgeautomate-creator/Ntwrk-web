/*
  # Remove Divisions and Consolidate to Teams Only - Final Version

  ## Overview
  Removes the divisions system entirely and consolidates to teams table only.

  ## Changes
  1. Drop all RLS policies that depend on division_id
  2. Drop foreign key constraints to divisions
  3. Migrate data from divisions to teams references
  4. Remove division_id columns
  5. Drop divisions table
  6. Re-create RLS policies with team references
  7. Add appropriate indexes

  ## Security
  - RLS policies updated to use team_id
  - Team-based access control replaces division-based
*/

-- Step 1: Drop all RLS policies that reference division_id
DROP POLICY IF EXISTS "Users can view league teams in their organization" ON league_teams;
DROP POLICY IF EXISTS "Captains and admins can manage team rosters" ON league_teams;
DROP POLICY IF EXISTS "Captains and admins can manage substitutes" ON substitutes;
DROP POLICY IF EXISTS "Captains can manage their team lineups" ON lineup_submissions;
DROP POLICY IF EXISTS "Team captains can manage their week rosters" ON week_rosters;

-- Step 2: Drop all foreign key constraints to divisions
ALTER TABLE team_matchups DROP CONSTRAINT IF EXISTS team_matchups_home_team_id_fkey;
ALTER TABLE team_matchups DROP CONSTRAINT IF EXISTS team_matchups_away_team_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_division_id_fkey;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_division_id_fkey;
ALTER TABLE league_teams DROP CONSTRAINT IF EXISTS league_teams_division_id_fkey;
ALTER TABLE team_standings DROP CONSTRAINT IF EXISTS team_standings_division_id_fkey;
ALTER TABLE substitutes DROP CONSTRAINT IF EXISTS substitutes_division_id_fkey;

-- Step 3: Update team_matchups to reference actual teams instead of divisions
UPDATE team_matchups tm
SET home_team_id = t.id
FROM teams t
WHERE t.division_id = tm.home_team_id;

UPDATE team_matchups tm
SET away_team_id = t.id
FROM teams t
WHERE t.division_id = tm.away_team_id;

-- Step 4: Update matches table (rename division_id to team_id)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'division_id') THEN
    IF EXISTS (SELECT 1 FROM matches LIMIT 1) THEN
      UPDATE matches m SET division_id = t.id FROM teams t WHERE t.division_id = m.division_id;
    END IF;
    ALTER TABLE matches RENAME COLUMN division_id TO team_id;
  END IF;
END $$;

-- Step 5: Update team_standings - remove division_id
ALTER TABLE team_standings DROP COLUMN IF EXISTS division_id;

-- Step 6: Update league_teams - add team_id and migrate data
ALTER TABLE league_teams ADD COLUMN IF NOT EXISTS team_id uuid;
UPDATE league_teams lt SET team_id = t.id FROM teams t WHERE t.division_id = lt.division_id;
ALTER TABLE league_teams DROP COLUMN IF EXISTS division_id CASCADE;
ALTER TABLE league_teams ALTER COLUMN team_id SET NOT NULL;

-- Step 7: Update substitutes - add team_id and migrate data  
ALTER TABLE substitutes ADD COLUMN IF NOT EXISTS team_id uuid;
UPDATE substitutes s SET team_id = t.id FROM teams t WHERE t.division_id = s.division_id;
ALTER TABLE substitutes DROP COLUMN IF EXISTS division_id CASCADE;
ALTER TABLE substitutes ALTER COLUMN team_id SET NOT NULL;

-- Step 8: Remove division_id from teams
ALTER TABLE teams DROP COLUMN IF EXISTS division_id CASCADE;

-- Step 9: Drop divisions table
DROP TABLE IF EXISTS division_participants CASCADE;
DROP TABLE IF EXISTS divisions CASCADE;

-- Step 10: Add foreign key constraints
ALTER TABLE team_matchups ADD CONSTRAINT team_matchups_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE team_matchups ADD CONSTRAINT team_matchups_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE league_teams ADD CONSTRAINT league_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE substitutes ADD CONSTRAINT substitutes_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'team_id') THEN
    ALTER TABLE matches ADD CONSTRAINT matches_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 11: Create indexes
CREATE INDEX IF NOT EXISTS idx_matches_team_id ON matches(team_id);
CREATE INDEX IF NOT EXISTS idx_league_teams_team_id ON league_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_substitutes_team_id ON substitutes(team_id);
CREATE INDEX IF NOT EXISTS idx_team_matchups_home_team ON team_matchups(home_team_id);
CREATE INDEX IF NOT EXISTS idx_team_matchups_away_team ON team_matchups(away_team_id);

-- Step 12: Re-create RLS policies

CREATE POLICY "Users can view league teams in their organization"
  ON league_teams FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN seasons s ON t.season_id = s.id
      JOIN leagues l ON s.league_id = l.id
      JOIN user_roles ur ON ur.organization_id = l.organization_id
      WHERE t.id = league_teams.team_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Captains and admins can manage team rosters"
  ON league_teams FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN seasons s ON t.season_id = s.id
      JOIN leagues l ON s.league_id = l.id
      JOIN user_roles ur ON ur.organization_id = l.organization_id
      WHERE t.id = league_teams.team_id AND ur.user_id = auth.uid()
      AND (ur.role IN ('admin', 'organizer') OR t.captain_user_id = auth.uid())
    )
  );

CREATE POLICY "Captains and admins can manage substitutes"
  ON substitutes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN seasons s ON t.season_id = s.id
      JOIN leagues l ON s.league_id = l.id
      JOIN user_roles ur ON ur.organization_id = l.organization_id
      WHERE t.id = substitutes.team_id AND ur.user_id = auth.uid()
      AND (ur.role IN ('admin', 'organizer') OR t.captain_user_id = auth.uid())
    )
  );
