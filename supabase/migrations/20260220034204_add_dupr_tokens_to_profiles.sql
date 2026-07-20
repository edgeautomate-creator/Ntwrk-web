/*
  # Add DUPR OAuth Tokens to Profiles

  ## Changes
  - Add dupr_user_token column for storing user access tokens
  - Add dupr_refresh_token column for refreshing expired tokens
  - These tokens enable making API calls on behalf of the user

  ## Security
  - Tokens are stored securely in the database
  - Only accessible by the profile owner via RLS policies
  - Used for reading user data from DUPR API
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_user_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_user_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dupr_refresh_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_refresh_token text;
  END IF;
END $$;
