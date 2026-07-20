/*
  # Create complete profiles table

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - References auth.users(id), user's unique identifier
      - `email` (text, unique) - User's email address
      - `full_name` (text) - User's full name (from username)
      - `display_name` (text) - Optional display name for the user
      - `dupr_id` (text) - DUPR ID for the user
      - `dupr_user_id` (text) - DUPR user ID
      - `dupr_rating` (numeric) - User's overall DUPR rating
      - `dupr_singles_rating` (numeric) - User's DUPR singles rating
      - `dupr_doubles_rating` (numeric) - User's DUPR doubles rating
      - `dupr_singles_wins` (integer) - Singles wins count
      - `dupr_singles_losses` (integer) - Singles losses count
      - `dupr_doubles_wins` (integer) - Doubles wins count
      - `dupr_doubles_losses` (integer) - Doubles losses count
      - `dupr_data` (jsonb) - Full DUPR profile data
      - `dupr_user_token` (text) - DUPR OAuth access token
      - `dupr_refresh_token` (text) - DUPR OAuth refresh token
      - `created_at` (timestamptz) - Profile creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `profiles` table
    - Add policy for authenticated users to read all profiles (needed for tournament/league viewing)
    - Add policy for users to insert their own profile
    - Add policy for users to update their own profile
    - Add policy for service role to insert profiles (for triggers)

  3. Constraints
    - Primary key on id
    - Foreign key to auth.users(id) with CASCADE delete
    - Unique constraint on email
    - Check constraint to ensure display_name is not empty string

  4. Triggers
    - Auto-create profile on user signup with email and username as full_name
*/

-- Drop table if it exists (to ensure clean state)
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table with all required columns
CREATE TABLE profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  display_name text,
  dupr_id text,
  dupr_user_id text,
  dupr_rating numeric,
  dupr_singles_rating numeric,
  dupr_doubles_rating numeric,
  dupr_singles_wins integer DEFAULT 0,
  dupr_singles_losses integer DEFAULT 0,
  dupr_doubles_wins integer DEFAULT 0,
  dupr_doubles_losses integer DEFAULT 0,
  dupr_data jsonb,
  dupr_user_token text,
  dupr_refresh_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (email),
  CHECK ((display_name IS NULL) OR (length(TRIM(BOTH FROM display_name)) > 0))
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create trigger function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', new.email)
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, do nothing
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_dupr_id ON profiles(dupr_id);
CREATE INDEX IF NOT EXISTS idx_profiles_dupr_user_id ON profiles(dupr_user_id);

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
