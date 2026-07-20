/*
  # Fix Database Security Issues - Complete

  1. Performance Optimizations
    - Add missing indexes for all foreign keys
    - Fix RLS policies to use (select auth.uid()) pattern

  2. Security Enhancements
    - Set search_path on all functions
    - Mark functions as SECURITY DEFINER
*/

-- =====================================================
-- PART 1: ADD MISSING INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_dupr_submissions_submitted_by ON dupr_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_games_winner_team_id ON games(winner_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_approved_by ON matches(approved_by);
CREATE INDEX IF NOT EXISTS idx_matches_team1_id ON matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_matches_team2_id ON matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_matches_winner_team_id ON matches(winner_team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team1_id ON tournament_matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team2_id ON tournament_matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner_id ON tournament_matches(winner_id);

-- =====================================================
-- PART 2: FIX ALL RLS POLICIES
-- =====================================================

-- Organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations" ON organizations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = organizations.id AND user_roles.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Org admins can update their organization" ON organizations;
CREATE POLICY "Org admins can update their organization" ON organizations FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = organizations.id AND user_roles.user_id = (select auth.uid()) AND user_roles.role = 'org_admin'));

-- Leagues
DROP POLICY IF EXISTS "Users can view leagues in their organizations" ON leagues;
CREATE POLICY "Users can view leagues in their organizations" ON leagues FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = leagues.organization_id AND user_roles.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage leagues" ON leagues;
CREATE POLICY "Admins can manage leagues" ON leagues FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = leagues.organization_id AND user_roles.user_id = (select auth.uid()) AND user_roles.role IN ('org_admin', 'admin')));

-- Seasons
DROP POLICY IF EXISTS "Users can view seasons in their organizations" ON seasons;
CREATE POLICY "Users can view seasons in their organizations" ON seasons FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN leagues l ON l.organization_id = ur.organization_id WHERE l.id = seasons.league_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage seasons" ON seasons;
CREATE POLICY "Admins can manage seasons" ON seasons FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN leagues l ON l.organization_id = ur.organization_id WHERE l.id = seasons.league_id AND ur.user_id = (select auth.uid()) AND ur.role IN ('org_admin', 'admin')));

-- Divisions
DROP POLICY IF EXISTS "Users can view divisions in their organizations" ON divisions;
CREATE POLICY "Users can view divisions in their organizations" ON divisions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN leagues l ON l.organization_id = ur.organization_id INNER JOIN seasons s ON s.league_id = l.id WHERE s.id = divisions.season_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage divisions" ON divisions;
CREATE POLICY "Admins can manage divisions" ON divisions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN leagues l ON l.organization_id = ur.organization_id INNER JOIN seasons s ON s.league_id = l.id WHERE s.id = divisions.season_id AND ur.user_id = (select auth.uid()) AND ur.role IN ('org_admin', 'admin')));

-- Players
DROP POLICY IF EXISTS "Users can view players in their organizations" ON players;
CREATE POLICY "Users can view players in their organizations" ON players FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = players.organization_id AND user_roles.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage players" ON players;
CREATE POLICY "Admins can manage players" ON players FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = players.organization_id AND user_roles.user_id = (select auth.uid()) AND user_roles.role IN ('org_admin', 'admin')));

-- Division Players
DROP POLICY IF EXISTS "Users can view division players in their organizations" ON division_players;
CREATE POLICY "Users can view division players in their organizations" ON division_players FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN players p ON p.organization_id = ur.organization_id WHERE p.id = division_players.player_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage division players" ON division_players;
CREATE POLICY "Admins can manage division players" ON division_players FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN players p ON p.organization_id = ur.organization_id WHERE p.id = division_players.player_id AND ur.user_id = (select auth.uid()) AND ur.role IN ('org_admin', 'admin')));

-- Teams
DROP POLICY IF EXISTS "Users can view teams in their organizations" ON teams;
CREATE POLICY "Users can view teams in their organizations" ON teams FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = teams.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage teams" ON teams;
CREATE POLICY "Admins can manage teams" ON teams FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = teams.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid()) AND ur.role IN ('org_admin', 'admin')));

-- Matches
DROP POLICY IF EXISTS "Users can view matches in their organizations" ON matches;
CREATE POLICY "Users can view matches in their organizations" ON matches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = matches.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Players can create and update their matches" ON matches;
CREATE POLICY "Players can create and update their matches" ON matches FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = matches.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Players can update match status" ON matches;
CREATE POLICY "Players can update match status" ON matches FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM teams t WHERE (t.id = matches.team1_id OR t.id = matches.team2_id) AND (t.player1_id = (select auth.uid()) OR t.player2_id = (select auth.uid()))));

DROP POLICY IF EXISTS "Admins can delete matches" ON matches;
CREATE POLICY "Admins can delete matches" ON matches FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = matches.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid()) AND ur.role IN ('org_admin', 'admin')));

-- Games
DROP POLICY IF EXISTS "Users can view games in their organizations" ON games;
CREATE POLICY "Users can view games in their organizations" ON games FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN matches m ON m.id = games.match_id INNER JOIN divisions d ON d.id = m.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can manage games" ON games;
CREATE POLICY "Users can manage games" ON games FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN matches m ON m.id = games.match_id INNER JOIN divisions d ON d.id = m.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

-- Standings
DROP POLICY IF EXISTS "Users can view standings in their organizations" ON standings;
CREATE POLICY "Users can view standings in their organizations" ON standings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = standings.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "System can manage standings" ON standings;
CREATE POLICY "System can manage standings" ON standings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = standings.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

-- Player Stats
DROP POLICY IF EXISTS "Users can view player stats in their organizations" ON player_stats;
CREATE POLICY "Users can view player stats in their organizations" ON player_stats FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = player_stats.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "System can manage player stats" ON player_stats;
CREATE POLICY "System can manage player stats" ON player_stats FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = player_stats.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

-- Pair Stats
DROP POLICY IF EXISTS "Users can view pair stats in their organizations" ON pair_stats;
CREATE POLICY "Users can view pair stats in their organizations" ON pair_stats FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = pair_stats.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "System can manage pair stats" ON pair_stats;
CREATE POLICY "System can manage pair stats" ON pair_stats FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN divisions d ON d.id = pair_stats.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

-- DUPR Submissions
DROP POLICY IF EXISTS "Users can view DUPR submissions in their organizations" ON dupr_submissions;
CREATE POLICY "Users can view DUPR submissions in their organizations" ON dupr_submissions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN matches m ON m.id = dupr_submissions.match_id INNER JOIN divisions d ON d.id = m.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can manage DUPR submissions" ON dupr_submissions;
CREATE POLICY "Admins can manage DUPR submissions" ON dupr_submissions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur INNER JOIN matches m ON m.id = dupr_submissions.match_id INNER JOIN divisions d ON d.id = m.division_id INNER JOIN seasons s ON s.id = d.season_id INNER JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = ur.organization_id AND ur.user_id = (select auth.uid()) AND ur.role IN ('org_admin', 'admin')));

-- Audit Logs
DROP POLICY IF EXISTS "Admins can view audit logs in their organizations" ON audit_logs;
CREATE POLICY "Admins can view audit logs in their organizations" ON audit_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = audit_logs.organization_id AND user_roles.user_id = (select auth.uid()) AND user_roles.role IN ('org_admin', 'admin')));

DROP POLICY IF EXISTS "System can create audit logs" ON audit_logs;
CREATE POLICY "System can create audit logs" ON audit_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.organization_id = audit_logs.organization_id AND user_roles.user_id = (select auth.uid())));

-- User Roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can assign themselves as org_admin on signup" ON user_roles;
CREATE POLICY "Users can assign themselves as org_admin on signup" ON user_roles FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()) AND role = 'org_admin' AND NOT EXISTS (SELECT 1 FROM user_roles existing WHERE existing.organization_id = user_roles.organization_id AND existing.role IN ('org_admin', 'admin')));

DROP POLICY IF EXISTS "Org admins can insert roles" ON user_roles;
CREATE POLICY "Org admins can insert roles" ON user_roles FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.organization_id = user_roles.organization_id AND ur.user_id = (select auth.uid()) AND ur.role = 'org_admin'));

DROP POLICY IF EXISTS "Org admins can update roles" ON user_roles;
CREATE POLICY "Org admins can update roles" ON user_roles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.organization_id = user_roles.organization_id AND ur.user_id = (select auth.uid()) AND ur.role = 'org_admin'));

DROP POLICY IF EXISTS "Org admins can delete roles" ON user_roles;
CREATE POLICY "Org admins can delete roles" ON user_roles FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.organization_id = user_roles.organization_id AND ur.user_id = (select auth.uid()) AND ur.role = 'org_admin'));

-- Tournaments
DROP POLICY IF EXISTS "Users can create tournaments" ON tournaments;
CREATE POLICY "Users can create tournaments" ON tournaments FOR INSERT TO authenticated
WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Creators can update tournaments" ON tournaments;
CREATE POLICY "Creators can update tournaments" ON tournaments FOR UPDATE TO authenticated
USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Creators can delete tournaments" ON tournaments;
CREATE POLICY "Creators can delete tournaments" ON tournaments FOR DELETE TO authenticated
USING (created_by = (select auth.uid()));

-- Tournament Participants
DROP POLICY IF EXISTS "Users can join tournaments" ON tournament_participants;
CREATE POLICY "Users can join tournaments" ON tournament_participants FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Creators can update participants" ON tournament_participants;
CREATE POLICY "Creators can update participants" ON tournament_participants FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_participants.tournament_id AND t.created_by = (select auth.uid())));

-- Tournament Matches
DROP POLICY IF EXISTS "Creators can create tournament matches" ON tournament_matches;
CREATE POLICY "Creators can create tournament matches" ON tournament_matches FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_matches.tournament_id AND t.created_by = (select auth.uid())));

DROP POLICY IF EXISTS "Creators and participants can update matches" ON tournament_matches;
CREATE POLICY "Creators and participants can update matches" ON tournament_matches FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_matches.tournament_id AND (t.created_by = (select auth.uid()) OR EXISTS (SELECT 1 FROM tournament_participants tp WHERE tp.tournament_id = t.id AND tp.user_id = (select auth.uid())))));

-- Tournament Teams
DROP POLICY IF EXISTS "Tournament creators can create team slots" ON tournament_teams;
CREATE POLICY "Tournament creators can create team slots" ON tournament_teams FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_teams.tournament_id AND t.created_by = (select auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can claim empty team slots" ON tournament_teams;
CREATE POLICY "Authenticated users can claim empty team slots" ON tournament_teams FOR UPDATE TO authenticated
USING (claimed_by_user_id IS NULL)
WITH CHECK (claimed_by_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their claimed teams" ON tournament_teams;
CREATE POLICY "Users can update their claimed teams" ON tournament_teams FOR UPDATE TO authenticated
USING (claimed_by_user_id = (select auth.uid()))
WITH CHECK (claimed_by_user_id = (select auth.uid()));

-- Profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated
WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

-- =====================================================
-- PART 3: FIX FUNCTIONS - DROP AND RECREATE
-- =====================================================

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS update_match_winner() CASCADE;
CREATE FUNCTION update_match_winner()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  team1_wins INTEGER := 0;
  team2_wins INTEGER := 0;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE winner_team_id = NEW.team1_id),
    COUNT(*) FILTER (WHERE winner_team_id = NEW.team2_id)
  INTO team1_wins, team2_wins
  FROM games
  WHERE match_id = NEW.id;

  IF team1_wins > team2_wins THEN
    NEW.winner_team_id := NEW.team1_id;
  ELSIF team2_wins > team1_wins THEN
    NEW.winner_team_id := NEW.team2_id;
  ELSE
    NEW.winner_team_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS recalculate_standings_for_division(uuid) CASCADE;
CREATE FUNCTION recalculate_standings_for_division(division_id_param UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM standings WHERE division_id = division_id_param;

  INSERT INTO standings (
    division_id, team_id, matches_played, matches_won, matches_lost,
    games_won, games_lost, points_for, points_against, win_percentage
  )
  SELECT
    division_id_param, t.id,
    COALESCE(COUNT(DISTINCT m.id), 0),
    COALESCE(SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.winner_team_id != t.id AND m.winner_team_id IS NOT NULL THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN g.winner_team_id = t.id THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN g.winner_team_id != t.id AND g.winner_team_id IS NOT NULL THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.team1_id = t.id THEN g.team1_score WHEN m.team2_id = t.id THEN g.team2_score ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.team1_id = t.id THEN g.team2_score WHEN m.team2_id = t.id THEN g.team1_score ELSE 0 END), 0),
    CASE WHEN COUNT(DISTINCT m.id) > 0 THEN (SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END)::FLOAT / COUNT(DISTINCT m.id)::FLOAT) ELSE 0 END
  FROM teams t
  LEFT JOIN matches m ON (m.team1_id = t.id OR m.team2_id = t.id) AND m.status = 'completed' AND m.division_id = division_id_param
  LEFT JOIN games g ON g.match_id = m.id
  WHERE t.division_id = division_id_param
  GROUP BY t.id;
END;
$$;

DROP FUNCTION IF EXISTS recalculate_player_stats_for_division(uuid) CASCADE;
CREATE FUNCTION recalculate_player_stats_for_division(division_id_param UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM player_stats WHERE division_id = division_id_param;

  INSERT INTO player_stats (
    division_id, player_id, matches_played, matches_won, matches_lost,
    games_won, games_lost, points_for, points_against, win_percentage
  )
  SELECT
    division_id_param, p.id,
    COUNT(DISTINCT m.id),
    SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END),
    SUM(CASE WHEN m.winner_team_id != t.id AND m.winner_team_id IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN g.winner_team_id = t.id THEN 1 ELSE 0 END),
    SUM(CASE WHEN g.winner_team_id != t.id AND g.winner_team_id IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN m.team1_id = t.id THEN g.team1_score WHEN m.team2_id = t.id THEN g.team2_score ELSE 0 END),
    SUM(CASE WHEN m.team1_id = t.id THEN g.team2_score WHEN m.team2_id = t.id THEN g.team1_score ELSE 0 END),
    CASE WHEN COUNT(DISTINCT m.id) > 0 THEN (SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END)::FLOAT / COUNT(DISTINCT m.id)::FLOAT) ELSE 0 END
  FROM players p
  INNER JOIN division_players dp ON dp.player_id = p.id AND dp.division_id = division_id_param
  LEFT JOIN teams t ON (t.player1_id = p.id OR t.player2_id = p.id) AND t.division_id = division_id_param
  LEFT JOIN matches m ON (m.team1_id = t.id OR m.team2_id = t.id) AND m.status = 'completed' AND m.division_id = division_id_param
  LEFT JOIN games g ON g.match_id = m.id
  GROUP BY p.id;
END;
$$;

DROP FUNCTION IF EXISTS recalculate_pair_stats_for_division(uuid) CASCADE;
CREATE FUNCTION recalculate_pair_stats_for_division(division_id_param UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM pair_stats WHERE division_id = division_id_param;

  INSERT INTO pair_stats (
    division_id, player1_id, player2_id, matches_played, matches_won, matches_lost,
    games_won, games_lost, points_for, points_against, win_percentage
  )
  SELECT
    division_id_param,
    LEAST(t.player1_id, t.player2_id),
    GREATEST(t.player1_id, t.player2_id),
    COUNT(DISTINCT m.id),
    SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END),
    SUM(CASE WHEN m.winner_team_id != t.id AND m.winner_team_id IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN g.winner_team_id = t.id THEN 1 ELSE 0 END),
    SUM(CASE WHEN g.winner_team_id != t.id AND g.winner_team_id IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN m.team1_id = t.id THEN g.team1_score WHEN m.team2_id = t.id THEN g.team2_score ELSE 0 END),
    SUM(CASE WHEN m.team1_id = t.id THEN g.team2_score WHEN m.team2_id = t.id THEN g.team1_score ELSE 0 END),
    CASE WHEN COUNT(DISTINCT m.id) > 0 THEN (SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END)::FLOAT / COUNT(DISTINCT m.id)::FLOAT) ELSE 0 END
  FROM teams t
  LEFT JOIN matches m ON (m.team1_id = t.id OR m.team2_id = t.id) AND m.status = 'completed' AND m.division_id = division_id_param
  LEFT JOIN games g ON g.match_id = m.id
  WHERE t.division_id = division_id_param
  GROUP BY LEAST(t.player1_id, t.player2_id), GREATEST(t.player1_id, t.player2_id);
END;
$$;

DROP FUNCTION IF EXISTS trigger_recalculate_stats() CASCADE;
CREATE FUNCTION trigger_recalculate_stats()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM recalculate_standings_for_division(COALESCE(NEW.division_id, OLD.division_id));
  PERFORM recalculate_player_stats_for_division(COALESCE(NEW.division_id, OLD.division_id));
  PERFORM recalculate_pair_stats_for_division(COALESCE(NEW.division_id, OLD.division_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER recalculate_stats_on_match_change
  AFTER INSERT OR UPDATE OR DELETE ON matches
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_stats();

CREATE TRIGGER recalculate_stats_on_game_change
  AFTER INSERT OR UPDATE OR DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_stats();
