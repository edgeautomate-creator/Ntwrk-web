/*
  # Add Group Stage Support to Tournaments

  ## Overview
  Adds group stage functionality to tournaments, allowing teams to be divided into groups
  for initial round-robin play before playoffs.

  ## Changes to Tables

  ### tournaments
  - `groups_enabled` (boolean) - Whether groups are used in this tournament
  - `number_of_groups` (integer, nullable) - Number of groups (2-4)
  - `teams_per_group_advancing` (integer, nullable) - How many teams advance from each group

  ### tournament_teams
  - `group_name` (text, nullable) - Group identifier (e.g., "Group A", "Group B")
  - `group_position` (integer, nullable) - Position within the group for seeding

  ### tournament_matches
  - `group_name` (text, nullable) - Group identifier for group stage matches

  ## Important Notes
  - Groups are optional and controlled by `groups_enabled` toggle
  - When groups are enabled, teams play round-robin within their group only
  - Top teams from each group advance to playoffs based on `teams_per_group_advancing`
  - Group names are assigned alphabetically (A, B, C, D)
  - All changes are nullable to maintain backward compatibility

  ## Security
  - No RLS changes needed - existing policies cover new columns
*/

-- Add group stage columns to tournaments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'groups_enabled'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN groups_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'number_of_groups'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN number_of_groups integer CHECK (number_of_groups >= 2 AND number_of_groups <= 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'teams_per_group_advancing'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN teams_per_group_advancing integer CHECK (teams_per_group_advancing >= 1);
  END IF;
END $$;

-- Add group columns to tournament_teams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_teams' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE tournament_teams ADD COLUMN group_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_teams' AND column_name = 'group_position'
  ) THEN
    ALTER TABLE tournament_teams ADD COLUMN group_position integer;
  END IF;
END $$;

-- Add group column to tournament_matches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN group_name text;
  END IF;
END $$;

-- Create indexes for group-based queries
CREATE INDEX IF NOT EXISTS idx_tournament_teams_group_name ON tournament_teams(tournament_id, group_name);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_group_name ON tournament_matches(tournament_id, group_name);

-- Add comment explaining group stage flow
COMMENT ON COLUMN tournaments.groups_enabled IS 'When true, teams are divided into groups for initial round-robin play';
COMMENT ON COLUMN tournaments.number_of_groups IS 'Number of groups (2-4) when groups_enabled is true';
COMMENT ON COLUMN tournaments.teams_per_group_advancing IS 'Number of teams from each group that advance to playoffs';
COMMENT ON COLUMN tournament_teams.group_name IS 'Group identifier (A, B, C, D) assigned during tournament setup';
COMMENT ON COLUMN tournament_teams.group_position IS 'Position within group for seeding (1 = best in group)';
COMMENT ON COLUMN tournament_matches.group_name IS 'Group identifier for group stage matches';