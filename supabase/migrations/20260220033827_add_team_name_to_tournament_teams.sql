/*
  # Add Team Name Column

  ## Changes
  - Add optional team_name column to tournament_teams table
  - Allows teams to have custom names (e.g., "Thunder Strikers" instead of "Team 1")
  - If no custom name is set, UI will display default "Team {number}"

  ## Notes
  - Column is nullable to maintain backward compatibility
  - Teams can be renamed before schedule generation starts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_teams' AND column_name = 'team_name'
  ) THEN
    ALTER TABLE tournament_teams ADD COLUMN team_name text;
  END IF;
END $$;
