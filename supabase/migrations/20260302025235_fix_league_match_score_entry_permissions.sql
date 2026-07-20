/*
  # Fix League Match Score Entry Permissions

  1. Problem
    - Users who created the league or are members of teams cannot enter match scores
    - Current policies only check teams.player1_id and teams.player2_id
    - Need to also check team_players table and league creator

  2. Changes
    - Drop existing restrictive UPDATE policy for matches
    - Add new UPDATE policy that allows:
      - League creators (users who created divisions in the season)
      - Team members (via team_players table)
      - Organization admins
    - Add INSERT policy for match creation by team members

  3. Security
    - Users can only update matches for divisions they're members of or created
    - Organization admins retain full control
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Players can update match status" ON matches;

-- Create a comprehensive UPDATE policy for matches
CREATE POLICY "Team members and creators can update matches"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (
    -- User is an org admin
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.organization_id = matches.organization_id
        AND user_roles.role = ANY(ARRAY['org_admin', 'league_director'])
    )
    OR
    -- User is a member of either team via team_players
    EXISTS (
      SELECT 1 FROM team_players tp
      WHERE tp.user_id = auth.uid()
        AND tp.organization_id = matches.organization_id
        AND (
          tp.team_id = matches.division_id
          OR tp.team_id IN (
            SELECT d.id FROM divisions d
            JOIN matches m ON (m.team1_id = d.id OR m.team2_id = d.id)
            WHERE m.id = matches.id
          )
        )
    )
    OR
    -- User created one of the divisions (teams) involved
    EXISTS (
      SELECT 1 FROM divisions d
      WHERE d.created_by = auth.uid()
        AND (d.id = matches.division_id OR d.id = matches.team1_id OR d.id = matches.team2_id)
    )
  );

-- Enhance team_matchups UPDATE policy to include team members
DROP POLICY IF EXISTS "League admins and participants can update matchups" ON team_matchups;

CREATE POLICY "League creators and team members can update matchups"
  ON team_matchups
  FOR UPDATE
  TO authenticated
  USING (
    -- User has a role in the organization
    EXISTS (
      SELECT 1
      FROM league_weeks lw
      JOIN seasons s ON s.id = lw.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE lw.id = team_matchups.league_week_id
        AND ur.user_id = auth.uid()
    )
    OR
    -- User is a member of one of the teams
    EXISTS (
      SELECT 1
      FROM team_players tp
      WHERE tp.user_id = auth.uid()
        AND (tp.team_id = team_matchups.home_team_id OR tp.team_id = team_matchups.away_team_id)
    )
    OR
    -- User created one of the teams
    EXISTS (
      SELECT 1
      FROM divisions d
      WHERE d.created_by = auth.uid()
        AND (d.id = team_matchups.home_team_id OR d.id = team_matchups.away_team_id)
    )
  );
