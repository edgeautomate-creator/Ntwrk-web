/*
  # Fix Remaining Security Issues

  ## 1. Add Missing Foreign Key Indexes
  Add indexes for all unindexed foreign keys across:
  - audit_logs (organization_id, user_id)
  - division_players (organization_id, player_id)
  - divisions (organization_id)
  - dupr_submissions (match_id, organization_id, submitted_by)
  - games (organization_id, winner_team_id)
  - matches (approved_by, division_id, team1_id, team2_id, winner_team_id)
  - organizations (created_by)
  - pair_stats (organization_id, player1_id, player2_id)
  - player_stats (organization_id)
  - standings (organization_id, team_id)
  - teams (organization_id)
  - tournament_teams (claimed_by_user_id, player1_user_id, player2_user_id)
  - user_roles (organization_id)

  ## 2. Optimize RLS Policies
  Replace `auth.uid()` with `(SELECT auth.uid())` in all policies to improve performance:
  - organizations
  - user_roles
  - leagues, seasons, divisions, players, division_players
  - teams, games, dupr_submissions, tournament_teams

  ## 3. Unused Indexes
  Keep the newly created indexes as they will be used as the application scales

  ## Notes
  - All indexes use IF NOT EXISTS for safety
  - Policies are dropped and recreated with optimized queries
  - Performance improvements will be significant at scale
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- audit_logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- division_players indexes
CREATE INDEX IF NOT EXISTS idx_division_players_organization_id ON division_players(organization_id);
CREATE INDEX IF NOT EXISTS idx_division_players_player_id ON division_players(player_id);

-- divisions indexes
CREATE INDEX IF NOT EXISTS idx_divisions_organization_id ON divisions(organization_id);

-- dupr_submissions indexes
CREATE INDEX IF NOT EXISTS idx_dupr_submissions_match_id ON dupr_submissions(match_id);
CREATE INDEX IF NOT EXISTS idx_dupr_submissions_organization_id ON dupr_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_dupr_submissions_submitted_by ON dupr_submissions(submitted_by);

-- games indexes
CREATE INDEX IF NOT EXISTS idx_games_organization_id ON games(organization_id);
CREATE INDEX IF NOT EXISTS idx_games_winner_team_id ON games(winner_team_id);

-- matches indexes
CREATE INDEX IF NOT EXISTS idx_matches_approved_by ON matches(approved_by);
CREATE INDEX IF NOT EXISTS idx_matches_division_id ON matches(division_id);
CREATE INDEX IF NOT EXISTS idx_matches_team1_id ON matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_matches_team2_id ON matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_matches_winner_team_id ON matches(winner_team_id);

-- organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- pair_stats indexes
CREATE INDEX IF NOT EXISTS idx_pair_stats_organization_id ON pair_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_pair_stats_player1_id ON pair_stats(player1_id);
CREATE INDEX IF NOT EXISTS idx_pair_stats_player2_id ON pair_stats(player2_id);

-- player_stats indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_organization_id ON player_stats(organization_id);

-- standings indexes
CREATE INDEX IF NOT EXISTS idx_standings_organization_id ON standings(organization_id);
CREATE INDEX IF NOT EXISTS idx_standings_team_id ON standings(team_id);

-- teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);

-- tournament_teams indexes
CREATE INDEX IF NOT EXISTS idx_tournament_teams_claimed_by_user_id ON tournament_teams(claimed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_player1_user_id ON tournament_teams(player1_user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_player2_user_id ON tournament_teams(player2_user_id);

-- user_roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);

-- =====================================================
-- 2. OPTIMIZE RLS POLICIES WITH SELECT auth.uid()
-- =====================================================

-- Optimize organizations policy
DROP POLICY IF EXISTS "Users can create organizations for themselves" ON organizations;
CREATE POLICY "Users can create organizations for themselves"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- Optimize user_roles policy
DROP POLICY IF EXISTS "Users can create roles" ON user_roles;
CREATE POLICY "Users can create roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_roles existing
      WHERE existing.user_id = (SELECT auth.uid())
      AND existing.organization_id = user_roles.organization_id
      AND existing.role = 'org_admin'
    )
  );

-- Optimize leagues policy
DROP POLICY IF EXISTS "Users can view leagues in their orgs" ON leagues;
CREATE POLICY "Users can view leagues in their orgs"
  ON leagues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = leagues.organization_id
    )
  );

-- Optimize seasons policy
DROP POLICY IF EXISTS "Users can view seasons in their orgs" ON seasons;
CREATE POLICY "Users can view seasons in their orgs"
  ON seasons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = seasons.organization_id
    )
  );

-- Optimize divisions policy
DROP POLICY IF EXISTS "Users can view divisions in their orgs" ON divisions;
CREATE POLICY "Users can view divisions in their orgs"
  ON divisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = divisions.organization_id
    )
  );

-- Optimize players policy
DROP POLICY IF EXISTS "Users can view players in their orgs" ON players;
CREATE POLICY "Users can view players in their orgs"
  ON players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = players.organization_id
    )
  );

-- Optimize division_players policy
DROP POLICY IF EXISTS "Users can view division players in their orgs" ON division_players;
CREATE POLICY "Users can view division players in their orgs"
  ON division_players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = division_players.organization_id
    )
  );

-- Optimize teams policy
DROP POLICY IF EXISTS "Users can view teams in their orgs" ON teams;
CREATE POLICY "Users can view teams in their orgs"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = teams.organization_id
    )
  );

-- Optimize games policy
DROP POLICY IF EXISTS "Users can view games in their orgs" ON games;
CREATE POLICY "Users can view games in their orgs"
  ON games FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = games.organization_id
    )
  );

-- Optimize dupr_submissions policy
DROP POLICY IF EXISTS "Users can view DUPR submissions in their orgs" ON dupr_submissions;
CREATE POLICY "Users can view DUPR submissions in their orgs"
  ON dupr_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.organization_id = dupr_submissions.organization_id
    )
  );

-- Optimize tournament_teams policy
DROP POLICY IF EXISTS "Users can update tournament teams" ON tournament_teams;
CREATE POLICY "Users can update tournament teams"
  ON tournament_teams FOR UPDATE
  TO authenticated
  USING (
    player1_user_id = (SELECT auth.uid()) OR 
    player2_user_id = (SELECT auth.uid()) OR
    player1_user_id IS NULL OR
    player2_user_id IS NULL
  )
  WITH CHECK (
    player1_user_id = (SELECT auth.uid()) OR 
    player2_user_id = (SELECT auth.uid()) OR
    player1_user_id IS NULL OR
    player2_user_id IS NULL
  );
