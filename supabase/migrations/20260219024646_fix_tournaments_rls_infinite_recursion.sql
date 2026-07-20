/*
  # Fix Infinite Recursion in Tournaments RLS Policies

  ## Problem
  The SELECT policies for tournaments table had overlapping conditions causing infinite recursion.
  Two separate policies for public and private tournaments were causing the database to loop.

  ## Solution
  - Drop existing SELECT policies
  - Create a single combined SELECT policy that handles both public and private tournaments
  - Simplify the logic to avoid recursive checks

  ## Changes
  1. Drop problematic SELECT policies
  2. Create unified SELECT policy for tournaments
  3. Maintain security for private tournaments
*/

-- Drop existing problematic SELECT policies
DROP POLICY IF EXISTS "Anyone can view public tournaments" ON tournaments;
DROP POLICY IF EXISTS "Participants can view private tournaments" ON tournaments;

-- Create a single unified SELECT policy
CREATE POLICY "Users can view tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (
    is_private = false OR 
    created_by = auth.uid() OR
    id IN (
      SELECT tournament_id 
      FROM tournament_participants 
      WHERE user_id = auth.uid() 
      AND status = 'approved'
    )
  );
