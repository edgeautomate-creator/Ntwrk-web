/*
  # Fix Profiles with NULL full_name Values

  1. Problem
    - Some user profiles have NULL full_name values
    - This causes "Unknown Player" to display in team rosters
    - Users who signed up get profiles created but without proper names

  2. Solution
    - Update all profiles with NULL full_name to use email username
    - Extract the username portion (before @) from auth.users.email
    - This provides a reasonable default display name

  3. Changes
    - Update profiles.full_name where it's NULL
    - Use email username from auth.users as the fallback value
*/

-- Update existing profiles that have NULL full_name
UPDATE profiles
SET full_name = split_part(auth.users.email, '@', 1)
FROM auth.users
WHERE profiles.id = auth.users.id
  AND profiles.full_name IS NULL;
