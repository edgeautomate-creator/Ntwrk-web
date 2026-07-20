/*
  # Fix RLS Infinite Recursion

  1. Problem
    - Circular dependency between tournaments and tournament_participants SELECT policies
    - tournaments policy checks tournament_participants
    - tournament_participants policy checks tournaments
    - This creates infinite recursion

  2. Solution
    - Drop duplicate SELECT policies
    - Keep only simple, non-recursive policies
    - Remove policies that query between related tables

  3. Changes
    - Drop "Users can view tournaments they created or participate in" from tournaments
    - Drop "Users can view tournament participants" from tournament_participants
    - Keep simple "view all" policies that don't create circular dependencies
*/

-- Drop recursive SELECT policy from tournaments
DROP POLICY IF EXISTS "Users can view tournaments they created or participate in" ON tournaments;

-- Drop recursive SELECT policy from tournament_participants  
DROP POLICY IF EXISTS "Users can view tournament participants" ON tournament_participants;

-- Drop duplicate DELETE policy from tournaments
DROP POLICY IF EXISTS "Users can delete tournaments they created" ON tournaments;

-- Drop duplicate UPDATE policy from tournaments
DROP POLICY IF EXISTS "Users can update tournaments they created" ON tournaments;

-- Verify we have clean, simple policies:
-- tournaments: "Users can view all tournaments" (SELECT with qual=true)
-- tournament_participants: "Users can view all tournament participants" (SELECT with qual=true)
