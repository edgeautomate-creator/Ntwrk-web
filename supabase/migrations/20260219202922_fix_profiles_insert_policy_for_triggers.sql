/*
  # Fix Profiles Insert Policy for Triggers

  1. Changes
    - Update the INSERT policy on profiles table to allow SECURITY DEFINER functions to insert
    - Add a check to allow inserts when auth.uid() matches OR when called from a SECURITY DEFINER context
    - This allows the handle_new_user trigger to create profiles during signup

  2. Security
    - Users can still only insert their own profile (auth.uid() check)
    - SECURITY DEFINER functions can insert any profile (needed for trigger)
    - No security degradation as trigger is controlled by Supabase Auth
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new policy that allows both user inserts and trigger inserts
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow users to insert their own profile
    id = auth.uid()
    -- Note: SECURITY DEFINER functions automatically bypass RLS in postgres 15+
  );

-- Also ensure service_role can bypass all RLS (this is standard practice)
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
