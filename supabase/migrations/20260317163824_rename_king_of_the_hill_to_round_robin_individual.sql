/*
  # Rename King of the Hill to Round Robin (Individual)

  1. Schema Changes
    - Update tournaments format constraint to replace 'king_of_the_hill' with 'round_robin_individual'
    - Migrate all existing 'king_of_the_hill' tournaments to 'round_robin_individual'
    - Maintain all existing columns and relationships
    
  2. Data Migration
    - Updates 40 existing tournaments with format = 'king_of_the_hill' to 'round_robin_individual'
    - Preserves all other tournament data
    
  3. Notes
    - This is a simple rename to better describe the tournament structure
    - 'round_robin_individual' distinguishes from team-based 'round_robin' format
    - UI will display this as "Round Robin" in contexts where individual format is clear
    - All existing functionality remains unchanged
*/

-- Step 1: Drop existing format constraint FIRST
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_format_check;

-- Step 2: Add new format constraint with BOTH old and new values temporarily
ALTER TABLE tournaments ADD CONSTRAINT tournaments_format_check 
  CHECK (format = ANY (ARRAY['round_robin'::text, 'group_stage_playoffs'::text, 'king_of_the_hill'::text, 'round_robin_individual'::text]));

-- Step 3: Migrate existing data
UPDATE tournaments 
SET format = 'round_robin_individual' 
WHERE format = 'king_of_the_hill';

-- Step 4: Drop constraint again and add final version without king_of_the_hill
ALTER TABLE tournaments DROP CONSTRAINT tournaments_format_check;

-- Step 5: Add final format constraint with only the new values
ALTER TABLE tournaments ADD CONSTRAINT tournaments_format_check 
  CHECK (format = ANY (ARRAY['round_robin'::text, 'group_stage_playoffs'::text, 'round_robin_individual'::text]));

-- Update column comment for clarity
COMMENT ON COLUMN tournaments.format IS 'Tournament format: round_robin (team-based), group_stage_playoffs (team-based with groups), or round_robin_individual (individual players)';
