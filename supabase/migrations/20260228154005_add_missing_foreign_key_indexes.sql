/*
  # Add Missing Foreign Key Indexes for Performance

  1. Performance Improvements
    - Add indexes on all foreign key columns to improve join performance
    - Indexes are critical for query optimization when joining tables
    
  2. Tables Updated
    - audit_logs: Add indexes for organization_id, user_id
    - division_players: Add indexes for organization_id, player_id
    - divisions: Add index for organization_id
    - dupr_submissions: Add indexes for match_id, organization_id, submitted_by
    - games: Add indexes for organization_id, winner_team_id
    - matches: Add indexes for approved_by, division_id, team1_id, team2_id, winner_team_id
    - organizations: Add index for created_by
    - pair_stats: Add indexes for organization_id, player1_id, player2_id
    - pickup_matchups: Add indexes for all player and team foreign keys
    - player_stats: Add index for organization_id
    - standings: Add indexes for organization_id, team_id
    - teams: Add index for organization_id
    - tournament_matches: Add index for winner_team_id
    - tournament_teams: Add indexes for claimed_by_user_id, player1_user_id, player2_user_id
    - tournaments: Add index for champion_team_id
    - user_roles: Add index for organization_id

  3. Cleanup
    - Remove unused indexes from pickup_playoff_matchups table
*/

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

-- pickup_matchups indexes
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_a_id ON pickup_matchups(player_a_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_a_user_id ON pickup_matchups(player_a_user_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_b_id ON pickup_matchups(player_b_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_player_b_user_id ON pickup_matchups(player_b_user_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_round_id ON pickup_matchups(round_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player1_id ON pickup_matchups(team1_player1_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player1_user_id ON pickup_matchups(team1_player1_user_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player2_id ON pickup_matchups(team1_player2_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team1_player2_user_id ON pickup_matchups(team1_player2_user_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player1_id ON pickup_matchups(team2_player1_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player1_user_id ON pickup_matchups(team2_player1_user_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player2_id ON pickup_matchups(team2_player2_id);
CREATE INDEX IF NOT EXISTS idx_pickup_matchups_team2_player2_user_id ON pickup_matchups(team2_player2_user_id);

-- player_stats indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_organization_id ON player_stats(organization_id);

-- standings indexes
CREATE INDEX IF NOT EXISTS idx_standings_organization_id ON standings(organization_id);
CREATE INDEX IF NOT EXISTS idx_standings_team_id ON standings(team_id);

-- teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);

-- tournament_matches indexes
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner_team_id ON tournament_matches(winner_team_id);

-- tournament_teams indexes
CREATE INDEX IF NOT EXISTS idx_tournament_teams_claimed_by_user_id ON tournament_teams(claimed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_player1_user_id ON tournament_teams(player1_user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_player2_user_id ON tournament_teams(player2_user_id);

-- tournaments indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_champion_team_id ON tournaments(champion_team_id);

-- user_roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);

-- Remove unused indexes from pickup_playoff_matchups
DROP INDEX IF EXISTS idx_pickup_playoff_matchups_advances_to_match;
DROP INDEX IF EXISTS idx_pickup_playoff_matchups_player_a_user_id;
DROP INDEX IF EXISTS idx_pickup_playoff_matchups_player_b_user_id;
DROP INDEX IF EXISTS idx_pickup_playoff_matchups_team1_player1_user_id;
DROP INDEX IF EXISTS idx_pickup_playoff_matchups_team1_player2_user_id;
DROP INDEX IF EXISTS idx_pickup_playoff_matchups_team2_player1_user_id;
DROP INDEX IF EXISTS idx_pickup_playoff_matchups_team2_player2_user_id;