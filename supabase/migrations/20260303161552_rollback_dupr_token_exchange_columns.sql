/*
  # Rollback DUPR Token Exchange Columns

  ## Overview
  Removes columns and indexes that were added for DUPR token exchange support,
  which is no longer needed in the application.

  ## Changes
  1. Drop Columns
    - `dupr_readonly_token` - OAuth readonly token (no longer needed)
    - `dupr_full_access_token` - Exchanged full access token (no longer needed)
    - `dupr_token_expires_at` - Token expiration tracking (no longer needed)
    - `dupr_token_type` - Token type tracking (no longer needed)

  2. Drop Indexes
    - `idx_profiles_dupr_token_expires` - Index for token expiration checks
    - `idx_profiles_dupr_token_type` - Index for token type filtering

  ## Notes
  - Existing `dupr_user_token` and `dupr_refresh_token` columns remain unchanged
  - These are still used for DUPR authentication and match submission
*/

-- Drop indexes first
DROP INDEX IF EXISTS idx_profiles_dupr_token_expires;
DROP INDEX IF EXISTS idx_profiles_dupr_token_type;

-- Drop columns from profiles table
DO $$
BEGIN
  -- Drop dupr_readonly_token column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_readonly_token'
  ) THEN
    ALTER TABLE profiles DROP COLUMN dupr_readonly_token;
  END IF;

  -- Drop dupr_full_access_token column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_full_access_token'
  ) THEN
    ALTER TABLE profiles DROP COLUMN dupr_full_access_token;
  END IF;

  -- Drop dupr_token_expires_at column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_token_expires_at'
  ) THEN
    ALTER TABLE profiles DROP COLUMN dupr_token_expires_at;
  END IF;

  -- Drop dupr_token_type column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_token_type'
  ) THEN
    ALTER TABLE profiles DROP COLUMN dupr_token_type;
  END IF;
END $$;
