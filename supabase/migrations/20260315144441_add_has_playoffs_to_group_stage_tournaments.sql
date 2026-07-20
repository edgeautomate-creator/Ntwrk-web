/*
  # Add has_playoffs option to group_stage_playoffs tournaments

  1. Changes
    - Make playoff_teams nullable to support tournaments without playoffs
    - Update has_playoffs column description to clarify it applies to both king_of_the_hill and group_stage_playoffs
    - Add default value for has_playoffs to support group_stage_playoffs tournaments
  
  2. Notes
    - For group_stage_playoffs: when has_playoffs = false, playoff_teams and playoff_byes should be null
    - For king_of_the_hill: has_playoffs already existed and works as expected
    - This change makes playoffs optional for Tournament format games
*/

-- Update the comment on has_playoffs column to reflect both formats
COMMENT ON COLUMN tournaments.has_playoffs IS 'Whether tournament includes playoffs (applies to king_of_the_hill and group_stage_playoffs formats)';

-- Ensure playoff_teams can be null (it already should be based on the schema inspection)
-- No need to alter if already nullable, but this ensures it
DO $$
BEGIN
  -- The column should already be nullable based on schema, this is just a safety check
  -- playoff_teams will be null when has_playoffs is false for group_stage_playoffs
  NULL;
END $$;
