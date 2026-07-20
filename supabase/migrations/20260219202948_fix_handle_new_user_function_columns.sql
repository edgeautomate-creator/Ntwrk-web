/*
  # Fix handle_new_user Function Column Mapping

  1. Changes
    - Update handle_new_user function to only insert columns that exist in profiles table
    - Profiles table has: id, dupr_id, dupr_rating, full_name, created_at, updated_at, dupr_*
    - Remove email column from INSERT as it doesn't exist in profiles table

  2. Security
    - Function remains SECURITY DEFINER to bypass RLS during signup
    - Only inserts safe metadata from auth.users
*/

-- Drop and recreate the function with correct columns
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile with only columns that exist in the table
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
