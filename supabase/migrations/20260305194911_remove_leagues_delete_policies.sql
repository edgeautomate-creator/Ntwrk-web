/*
  # Remove Delete Policies from Leagues Table

  1. Purpose
    - Removes all DELETE policies from the leagues table
    - Prevents deletion of leagues through RLS
  
  2. Changes
    - Drop both DELETE policies on leagues table
*/

-- Drop both delete policies
DROP POLICY IF EXISTS "League creator can delete leagues without scores" ON leagues;
DROP POLICY IF EXISTS "Org admins can delete leagues" ON leagues;
