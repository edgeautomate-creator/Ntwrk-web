/*
  # Add user_role column to user_dupr_clubs table

  1. Schema Changes
    - Add `user_role` column (text, nullable) to user_dupr_clubs table
    - This stores the user's role in the club (director, organizer, member, etc.)
    - Nullable to support backward compatibility with existing cached data

  2. Indexes
    - Add index on user_role for efficient filtering queries
    - This improves performance when filtering clubs by role

  3. Purpose
    - Enable filtering of DUPR clubs to show only those where user is director/organizer
    - Only directors and organizers should be able to create tournaments under a club
    - Maintains backward compatibility with existing cached data (null roles)

  4. Notes
    - Existing records will have null user_role until next sync
    - Edge function will populate this field from DUPR API response
    - Frontend filtering will only show director/organizer clubs in dropdown
*/

-- Add user_role column to store the user's role in each club
ALTER TABLE user_dupr_clubs
ADD COLUMN IF NOT EXISTS user_role text;

-- Add index on user_role for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_dupr_clubs_role
ON user_dupr_clubs(user_role);

-- Add comment to document the column
COMMENT ON COLUMN user_dupr_clubs.user_role IS 'User role in the club (director, organizer, member, etc.). Only director and organizer roles can create tournaments.';