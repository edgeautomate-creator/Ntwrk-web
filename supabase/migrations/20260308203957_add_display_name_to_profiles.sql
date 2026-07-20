/*
  # Add display_name to profiles table

  1. Changes
    - Add `display_name` column to profiles table (text, nullable)
    - Backfill display_name with full_name for existing users who have it
    - Add check constraint to ensure display_name is not empty if provided
  
  2. Security
    - No RLS policy changes needed (profiles already has proper RLS)
  
  3. Notes
    - display_name is nullable for backward compatibility
    - Priority order: display_name → full_name → email prefix → 'Player'
    - Users can update their display_name through the profile page
*/

-- Add display_name column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS display_name text;

-- Add constraint to prevent empty strings
ALTER TABLE profiles 
ADD CONSTRAINT display_name_not_empty 
CHECK (display_name IS NULL OR length(trim(display_name)) > 0);

-- Backfill display_name with full_name for existing users
UPDATE profiles 
SET display_name = full_name 
WHERE full_name IS NOT NULL AND display_name IS NULL;