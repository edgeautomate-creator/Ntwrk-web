/*
  # Add King of the Hill Tournament Format

  1. Schema Changes
    - Add 'king_of_the_hill' to tournaments format constraint
    - Add 'registration_type' column to distinguish team vs individual registration
    - Add 'player_capacity' column for King of the Hill tournaments
    
  2. Security
    - All existing RLS policies continue to work
    - No changes needed to security model
    
  3. Notes
    - Maintains backward compatibility with existing tournaments
    - registration_type defaults to 'team' for existing data
    - player_capacity is nullable (only required for king_of_the_hill format)
*/

-- Drop existing format constraint
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_format_check;

-- Add new format constraint including king_of_the_hill
ALTER TABLE tournaments ADD CONSTRAINT tournaments_format_check 
  CHECK (format = ANY (ARRAY['round_robin'::text, 'group_stage_playoffs'::text, 'king_of_the_hill'::text]));

-- Add registration_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'registration_type'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN registration_type text DEFAULT 'team' CHECK (registration_type = ANY (ARRAY['team'::text, 'individual'::text]));
  END IF;
END $$;

-- Add player_capacity column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'player_capacity'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN player_capacity integer CHECK (player_capacity IS NULL OR (player_capacity >= 2 AND player_capacity <= 100));
  END IF;
END $$;

-- Add has_playoffs column for King of the Hill tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'has_playoffs'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN has_playoffs boolean DEFAULT false;
  END IF;
END $$;

-- Add playoff_qualifiers column for King of the Hill tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'playoff_qualifiers'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN playoff_qualifiers integer DEFAULT 4 CHECK (playoff_qualifiers IS NULL OR playoff_qualifiers >= 2);
  END IF;
END $$;

-- Add comments for clarity
COMMENT ON COLUMN tournaments.registration_type IS 'Type of registration: team (for round_robin/group_stage) or individual (for king_of_the_hill)';
COMMENT ON COLUMN tournaments.player_capacity IS 'Maximum number of individual players for king_of_the_hill format';
COMMENT ON COLUMN tournaments.has_playoffs IS 'Whether king_of_the_hill tournament includes playoffs';
COMMENT ON COLUMN tournaments.playoff_qualifiers IS 'Number of players/teams qualifying for playoffs in king_of_the_hill format';