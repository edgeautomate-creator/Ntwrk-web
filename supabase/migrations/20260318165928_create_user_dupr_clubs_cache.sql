/*
  # Create DUPR Clubs Cache Table

  1. New Tables
    - `user_dupr_clubs`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - References profiles.id
      - `dupr_club_id` (text) - DUPR club identifier
      - `club_name` (text) - Name of the club
      - `club_data` (jsonb, nullable) - Full club data from DUPR API
      - `last_synced_at` (timestamptz) - When this club was last fetched from DUPR
      - `created_at` (timestamptz) - When this record was first created
      - `updated_at` (timestamptz) - When this record was last updated

  2. Security
    - Enable RLS on `user_dupr_clubs` table
    - Add policy for users to read their own cached clubs
    - Add policy for users to insert their own cached clubs (for edge function)
    - Add policy for users to update their own cached clubs (for edge function)
    - Add policy for users to delete their own cached clubs (for edge function)

  3. Indexes
    - Add index on user_id for efficient lookups
    - Add unique constraint on (user_id, dupr_club_id) combination

  4. Notes
    - This table serves as a cache for DUPR clubs API responses
    - When DUPR API fails, the edge function will fallback to this cached data
    - The last_synced_at timestamp helps track data freshness
*/

-- Create the user_dupr_clubs table
CREATE TABLE IF NOT EXISTS user_dupr_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dupr_club_id text NOT NULL,
  club_name text NOT NULL,
  club_data jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_club UNIQUE (user_id, dupr_club_id)
);

-- Add index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_user_dupr_clubs_user_id ON user_dupr_clubs(user_id);

-- Add index for last_synced_at to help with cache invalidation queries
CREATE INDEX IF NOT EXISTS idx_user_dupr_clubs_last_synced ON user_dupr_clubs(last_synced_at);

-- Enable RLS
ALTER TABLE user_dupr_clubs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own cached clubs
CREATE POLICY "Users can read own cached clubs"
  ON user_dupr_clubs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can insert cached clubs (for edge function)
CREATE POLICY "Service role can insert cached clubs"
  ON user_dupr_clubs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can update cached clubs (for edge function)
CREATE POLICY "Service role can update cached clubs"
  ON user_dupr_clubs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can delete cached clubs (for edge function)
CREATE POLICY "Service role can delete cached clubs"
  ON user_dupr_clubs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_dupr_clubs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_dupr_clubs_updated_at_trigger
  BEFORE UPDATE ON user_dupr_clubs
  FOR EACH ROW
  EXECUTE FUNCTION update_user_dupr_clubs_updated_at();