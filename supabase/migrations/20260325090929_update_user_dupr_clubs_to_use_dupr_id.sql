/*
  # Update user_dupr_clubs to use dupr_id instead of user_id

  1. Schema Changes
    - Drop existing RLS policies that depend on user_id column
    - Add `dupr_id` column (text)
    - Migrate existing data from profiles table
    - Drop old foreign key constraint
    - Drop old unique constraint on (user_id, dupr_club_id)
    - Add new unique constraint on (dupr_id, dupr_club_id)
    - Drop user_id column after migration
    - Update indexes

  2. RLS Policy Updates
    - Create new policies based on dupr_id lookup from profiles

  3. Data Integrity
    - Preserve all existing cached club data
    - Ensure no orphaned records
*/

-- Step 1: Drop existing RLS policies that depend on user_id
DROP POLICY IF EXISTS "Users can read own cached clubs" ON user_dupr_clubs;
DROP POLICY IF EXISTS "Service role can insert cached clubs" ON user_dupr_clubs;
DROP POLICY IF EXISTS "Service role can update cached clubs" ON user_dupr_clubs;
DROP POLICY IF EXISTS "Service role can delete cached clubs" ON user_dupr_clubs;

-- Step 2: Add dupr_id column (nullable initially for migration)
ALTER TABLE user_dupr_clubs 
ADD COLUMN IF NOT EXISTS dupr_id text;

-- Step 3: Migrate existing data - copy dupr_id from profiles
UPDATE user_dupr_clubs 
SET dupr_id = (
  SELECT dupr_id 
  FROM profiles 
  WHERE profiles.id = user_dupr_clubs.user_id
)
WHERE dupr_id IS NULL;

-- Step 4: Delete records where dupr_id couldn't be found (orphaned records)
DELETE FROM user_dupr_clubs 
WHERE dupr_id IS NULL;

-- Step 5: Make dupr_id NOT NULL (only if there are records, otherwise just set it as NOT NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_dupr_clubs LIMIT 1) THEN
    ALTER TABLE user_dupr_clubs 
    ALTER COLUMN dupr_id SET NOT NULL;
  ELSE
    ALTER TABLE user_dupr_clubs 
    ALTER COLUMN dupr_id SET NOT NULL;
  END IF;
END $$;

-- Step 6: Drop old foreign key constraint
ALTER TABLE user_dupr_clubs 
DROP CONSTRAINT IF EXISTS user_dupr_clubs_user_id_fkey;

-- Step 7: Drop old unique constraint if it exists
DROP INDEX IF EXISTS user_dupr_clubs_user_id_dupr_club_id_key;

-- Step 8: Add new unique constraint on (dupr_id, dupr_club_id)
CREATE UNIQUE INDEX IF NOT EXISTS user_dupr_clubs_dupr_id_dupr_club_id_key 
ON user_dupr_clubs(dupr_id, dupr_club_id);

-- Step 9: Drop old index on user_id
DROP INDEX IF EXISTS idx_user_dupr_clubs_user_id;

-- Step 10: Create new index on dupr_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_dupr_clubs_dupr_id 
ON user_dupr_clubs(dupr_id);

-- Step 11: Drop user_id column
ALTER TABLE user_dupr_clubs 
DROP COLUMN IF EXISTS user_id CASCADE;

-- Step 12: Create new RLS policies based on dupr_id
CREATE POLICY "Users can view clubs for their DUPR ID"
  ON user_dupr_clubs
  FOR SELECT
  TO authenticated
  USING (
    dupr_id = (SELECT dupr_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert clubs for their DUPR ID"
  ON user_dupr_clubs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    dupr_id = (SELECT dupr_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update clubs for their DUPR ID"
  ON user_dupr_clubs
  FOR UPDATE
  TO authenticated
  USING (
    dupr_id = (SELECT dupr_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    dupr_id = (SELECT dupr_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete clubs for their DUPR ID"
  ON user_dupr_clubs
  FOR DELETE
  TO authenticated
  USING (
    dupr_id = (SELECT dupr_id FROM profiles WHERE id = auth.uid())
  );
