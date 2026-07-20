-- Add dupr_user_id to profiles
-- When user logs in with DUPR, we store the DUPR platform user id here.
-- When user disconnects DUPR, this is cleared along with other DUPR fields.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'dupr_user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dupr_user_id text;
  END IF;
END $$;
