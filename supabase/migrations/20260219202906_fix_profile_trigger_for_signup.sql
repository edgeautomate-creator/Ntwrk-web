/*
  # Fix Profile Trigger for User Signup

  1. Changes
    - Drop and recreate the handle_new_user function with proper SECURITY DEFINER context
    - The function needs to bypass RLS policies when creating profiles during signup
    - Add explicit search_path and security settings to ensure the function runs with elevated privileges

  2. Security
    - Function is SECURITY DEFINER to bypass RLS during initial profile creation
    - Only runs on auth.users INSERT, controlled by Supabase Auth
    - No user-controlled input, only uses auth.users data
*/

-- Drop the existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate the function with proper security context
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile with explicit column mapping
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
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
