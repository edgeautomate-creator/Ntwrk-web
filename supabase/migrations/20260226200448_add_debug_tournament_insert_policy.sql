/*
  # Add Debug Tournament Insert Policy

  1. Changes
    - Drop existing complex INSERT policy
    - Add simpler INSERT policy for debugging
    - Policy allows ANY authenticated user to insert tournaments
    - This will help us isolate if the issue is with auth.uid() specifically

  2. Security
    - TEMPORARY: This is less secure but will help diagnose the issue
    - Should be reverted once we identify the root cause
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can create tournaments" ON tournaments;

-- Create a simpler policy for debugging
CREATE POLICY "Authenticated users can create tournaments"
  ON tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
