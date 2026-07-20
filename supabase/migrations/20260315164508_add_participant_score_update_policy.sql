/*
  # Allow tournament participants to update match scores

  1. Changes
    - Add new RLS policy to allow participants to update their own match scores
    - Participants can update scores if they are playing in the match
    - Checks both tournament_teams (for regular/group stage tournaments) and direct player IDs (for King of the Hill)

  2. Security
    - Only allows updates to matches where the user is a participant
    - Tournament creators retain full update access via existing policy
    - Maintains data security by restricting updates to involved parties only
*/

-- Add policy for participants to update match scores
CREATE POLICY "Participants can update their match scores"
  ON tournament_matches
  FOR UPDATE
  TO authenticated
  USING (
    -- Check if user is a participant in this specific match
    EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE (
        (tt.id = tournament_matches.team1_id OR tt.id = tournament_matches.team2_id)
        AND (
          tt.player1_user_id = auth.uid() 
          OR tt.player2_user_id = auth.uid()
        )
      )
    )
    OR
    -- For King of the Hill format, check direct player IDs
    (
      tournament_matches.player1_id = auth.uid()
      OR tournament_matches.player2_id = auth.uid()
      OR tournament_matches.player3_id = auth.uid()
      OR tournament_matches.player4_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same check for WITH CHECK clause
    EXISTS (
      SELECT 1
      FROM tournament_teams tt
      WHERE (
        (tt.id = tournament_matches.team1_id OR tt.id = tournament_matches.team2_id)
        AND (
          tt.player1_user_id = auth.uid() 
          OR tt.player2_user_id = auth.uid()
        )
      )
    )
    OR
    (
      tournament_matches.player1_id = auth.uid()
      OR tournament_matches.player2_id = auth.uid()
      OR tournament_matches.player3_id = auth.uid()
      OR tournament_matches.player4_id = auth.uid()
    )
  );
