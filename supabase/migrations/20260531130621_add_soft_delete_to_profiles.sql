/*
  # Add soft delete to profiles table

  1. Changes
    - Add `is_deleted` boolean column (default false) to `profiles`
    - Add index on `is_deleted` for efficient filtering

  2. Notes
    - Soft delete: when true the account is considered deleted
    - Users with is_deleted = true are blocked at login
    - No rows are physically removed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles (is_deleted);
