/*
  # Add League Creator Delete Policy

  1. Purpose
    - Allows league creators to delete their own leagues
  
  2. Changes
    - Add DELETE policy on leagues table for authenticated creators
*/

-- Allow league creator to delete their league
CREATE POLICY "League creator can delete own league"
  ON leagues
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
