/*
  # Comprehensive League Management System

  1. Schema Enhancements
    - Add league-specific columns to `seasons` table for match format, scoring, and rules
    - Create `league_weeks` table to track weekly matchups
    - Create `team_matchups` table for team-vs-team matchups (distinct from individual matches)
    - Add columns to `matches` table for matchup association
    - Create `league_teams` table for team roster management
    - Create `team_captains` table for captain assignments
    - Create `substitutes` table for substitute player tracking
    - Enhance `standings` table with league-specific metrics
    - Create `playoff_brackets` table for playoff management
    - Create `lineup_submissions` table for pre-match lineup tracking

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to access their league data
    - Restrict admin actions to league creators
    - Allow team captains to manage lineups and substitutes

  3. Performance
    - Add indexes on foreign keys and frequently queried columns
    - Add indexes for standings calculations
*/

-- Add league-specific columns to seasons table
DO $$ 
BEGIN
  -- League configuration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'league_type') THEN
    ALTER TABLE seasons ADD COLUMN league_type text DEFAULT 'non_dupr' CHECK (league_type IN ('dupr', 'non_dupr'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'players_per_team') THEN
    ALTER TABLE seasons ADD COLUMN players_per_team integer DEFAULT 2 CHECK (players_per_team > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'regular_season_weeks') THEN
    ALTER TABLE seasons ADD COLUMN regular_season_weeks integer DEFAULT 8 CHECK (regular_season_weeks > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'playoff_teams') THEN
    ALTER TABLE seasons ADD COLUMN playoff_teams integer DEFAULT 4 CHECK (playoff_teams >= 0);
  END IF;

  -- Substitute rules
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'allow_substitutes') THEN
    ALTER TABLE seasons ADD COLUMN allow_substitutes boolean DEFAULT false;
  END IF;

  -- Points system
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'use_points_system') THEN
    ALTER TABLE seasons ADD COLUMN use_points_system boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'points_for_matchup_win') THEN
    ALTER TABLE seasons ADD COLUMN points_for_matchup_win integer DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'points_for_tiebreaker_win') THEN
    ALTER TABLE seasons ADD COLUMN points_for_tiebreaker_win integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'points_for_tiebreaker_loss') THEN
    ALTER TABLE seasons ADD COLUMN points_for_tiebreaker_loss integer DEFAULT 0;
  END IF;

  -- Match format
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'matches_per_matchup') THEN
    ALTER TABLE seasons ADD COLUMN matches_per_matchup integer DEFAULT 3 CHECK (matches_per_matchup > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'game_format') THEN
    ALTER TABLE seasons ADD COLUMN game_format text DEFAULT 'rally' CHECK (game_format IN ('rally', 'side_out'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'game_to') THEN
    ALTER TABLE seasons ADD COLUMN game_to integer DEFAULT 11 CHECK (game_to > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'win_by_2') THEN
    ALTER TABLE seasons ADD COLUMN win_by_2 boolean DEFAULT true;
  END IF;

  -- Tiebreaker settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'enable_tiebreaker') THEN
    ALTER TABLE seasons ADD COLUMN enable_tiebreaker boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'tiebreaker_name') THEN
    ALTER TABLE seasons ADD COLUMN tiebreaker_name text DEFAULT 'DreamBreaker';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'tiebreaker_scoring_type') THEN
    ALTER TABLE seasons ADD COLUMN tiebreaker_scoring_type text DEFAULT 'rally';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'tiebreaker_game_to') THEN
    ALTER TABLE seasons ADD COLUMN tiebreaker_game_to integer DEFAULT 7 CHECK (tiebreaker_game_to > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'tiebreaker_win_by_2') THEN
    ALTER TABLE seasons ADD COLUMN tiebreaker_win_by_2 boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'rotation_required') THEN
    ALTER TABLE seasons ADD COLUMN rotation_required boolean DEFAULT false;
  END IF;

  -- Lineup enforcement
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'enforce_lineup_submission') THEN
    ALTER TABLE seasons ADD COLUMN enforce_lineup_submission boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'use_home_away_logic') THEN
    ALTER TABLE seasons ADD COLUMN use_home_away_logic boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'away_submits_first') THEN
    ALTER TABLE seasons ADD COLUMN away_submits_first boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'lock_lineups_after_submission') THEN
    ALTER TABLE seasons ADD COLUMN lock_lineups_after_submission boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'lineup_deadline_hours') THEN
    ALTER TABLE seasons ADD COLUMN lineup_deadline_hours integer DEFAULT 24 CHECK (lineup_deadline_hours >= 0);
  END IF;

  -- Substitute settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'substitute_requires_dupr') THEN
    ALTER TABLE seasons ADD COLUMN substitute_requires_dupr boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'show_dupr_penalty_suggestion') THEN
    ALTER TABLE seasons ADD COLUMN show_dupr_penalty_suggestion boolean DEFAULT false;
  END IF;

  -- Playoff status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'playoffs_started') THEN
    ALTER TABLE seasons ADD COLUMN playoffs_started boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'playoffs_started_at') THEN
    ALTER TABLE seasons ADD COLUMN playoffs_started_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'champion_team_id') THEN
    ALTER TABLE seasons ADD COLUMN champion_team_id uuid REFERENCES divisions(id);
  END IF;
END $$;

-- Create league_weeks table
CREATE TABLE IF NOT EXISTS league_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number > 0),
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(season_id, week_number)
);

ALTER TABLE league_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view league weeks in their organization"
  ON league_weeks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seasons s
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = league_weeks.season_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "League admins can manage weeks"
  ON league_weeks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = league_weeks.season_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'organizer')
    )
  );

CREATE INDEX IF NOT EXISTS idx_league_weeks_season ON league_weeks(season_id);
CREATE INDEX IF NOT EXISTS idx_league_weeks_status ON league_weeks(status);

-- Create team_matchups table (team vs team, contains multiple individual matches)
CREATE TABLE IF NOT EXISTS team_matchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_week_id uuid NOT NULL REFERENCES league_weeks(id) ON DELETE CASCADE,
  home_team_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  away_team_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  scheduled_time timestamptz,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'lineups_pending', 'in_progress', 'completed')),
  home_matchup_wins integer DEFAULT 0,
  away_matchup_wins integer DEFAULT 0,
  tiebreaker_winner_id uuid REFERENCES divisions(id),
  points_awarded_home integer DEFAULT 0,
  points_awarded_away integer DEFAULT 0,
  finalized boolean DEFAULT false,
  finalized_at timestamptz,
  finalized_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE team_matchups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view matchups in their organization"
  ON team_matchups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_weeks lw
      JOIN seasons s ON s.id = lw.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE lw.id = team_matchups.league_week_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "League admins and participants can update matchups"
  ON team_matchups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_weeks lw
      JOIN seasons s ON s.id = lw.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE lw.id = team_matchups.league_week_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "League admins can create matchups"
  ON team_matchups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM league_weeks lw
      JOIN seasons s ON s.id = lw.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE lw.id = team_matchups.league_week_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'organizer')
    )
  );

CREATE INDEX IF NOT EXISTS idx_team_matchups_week ON team_matchups(league_week_id);
CREATE INDEX IF NOT EXISTS idx_team_matchups_home_team ON team_matchups(home_team_id);
CREATE INDEX IF NOT EXISTS idx_team_matchups_away_team ON team_matchups(away_team_id);
CREATE INDEX IF NOT EXISTS idx_team_matchups_status ON team_matchups(status);

-- Add matchup association to matches table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'matchup_id') THEN
    ALTER TABLE matches ADD COLUMN matchup_id uuid REFERENCES team_matchups(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'match_number_in_matchup') THEN
    ALTER TABLE matches ADD COLUMN match_number_in_matchup integer DEFAULT 1 CHECK (match_number_in_matchup > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'is_tiebreaker') THEN
    ALTER TABLE matches ADD COLUMN is_tiebreaker boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_matchup ON matches(matchup_id);

-- Create league_teams table (team roster management)
CREATE TABLE IF NOT EXISTS league_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_number integer,
  is_captain boolean DEFAULT false,
  dupr_rating numeric(4,3),
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(division_id, user_id)
);

ALTER TABLE league_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view league teams in their organization"
  ON league_teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE d.id = league_teams.division_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Captains and admins can manage team rosters"
  ON league_teams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE d.id = league_teams.division_id
      AND (
        ur.user_id = auth.uid() AND ur.role IN ('admin', 'organizer')
        OR
        EXISTS (
          SELECT 1 FROM league_teams lt
          WHERE lt.division_id = d.id
          AND lt.user_id = auth.uid()
          AND lt.is_captain = true
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_league_teams_division ON league_teams(division_id);
CREATE INDEX IF NOT EXISTS idx_league_teams_user ON league_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_league_teams_captain ON league_teams(division_id, is_captain);

-- Create substitutes table
CREATE TABLE IF NOT EXISTS substitutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_player_id uuid REFERENCES auth.users(id),
  dupr_rating_at_substitution numeric(4,3),
  penalty_points integer DEFAULT 0,
  approved_by uuid REFERENCES auth.users(id),
  match_id uuid REFERENCES matches(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE substitutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view substitutes in their organization"
  ON substitutes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE d.id = substitutes.division_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Captains and admins can manage substitutes"
  ON substitutes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE d.id = substitutes.division_id
      AND (
        ur.user_id = auth.uid() AND ur.role IN ('admin', 'organizer')
        OR
        EXISTS (
          SELECT 1 FROM league_teams lt
          WHERE lt.division_id = d.id
          AND lt.user_id = auth.uid()
          AND lt.is_captain = true
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_substitutes_division ON substitutes(division_id);
CREATE INDEX IF NOT EXISTS idx_substitutes_user ON substitutes(user_id);
CREATE INDEX IF NOT EXISTS idx_substitutes_match ON substitutes(match_id);

-- Enhance standings table with league-specific metrics
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'standings' AND column_name = 'matchup_wins') THEN
    ALTER TABLE standings ADD COLUMN matchup_wins integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'standings' AND column_name = 'matchup_losses') THEN
    ALTER TABLE standings ADD COLUMN matchup_losses integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'tiebreaker_wins') THEN
    ALTER TABLE standings ADD COLUMN tiebreaker_wins integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'standings' AND column_name = 'tiebreaker_losses') THEN
    ALTER TABLE standings ADD COLUMN tiebreaker_losses integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'standings' AND column_name = 'league_points') THEN
    ALTER TABLE standings ADD COLUMN league_points integer DEFAULT 0;
  END IF;
END $$;

-- Create playoff_brackets table
CREATE TABLE IF NOT EXISTS playoff_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  round_name text NOT NULL,
  match_number integer NOT NULL,
  team1_id uuid REFERENCES divisions(id),
  team2_id uuid REFERENCES divisions(id),
  winner_id uuid REFERENCES divisions(id),
  seed_1 integer,
  seed_2 integer,
  team1_score integer,
  team2_score integer,
  scheduled_time timestamptz,
  completed_at timestamptz,
  bracket_position integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE playoff_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view playoff brackets in their organization"
  ON playoff_brackets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seasons s
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = playoff_brackets.season_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "League admins can manage playoff brackets"
  ON playoff_brackets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seasons s
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = playoff_brackets.season_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'organizer')
    )
  );

CREATE INDEX IF NOT EXISTS idx_playoff_brackets_season ON playoff_brackets(season_id);
CREATE INDEX IF NOT EXISTS idx_playoff_brackets_round ON playoff_brackets(round_name);

-- Create lineup_submissions table
CREATE TABLE IF NOT EXISTS lineup_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id uuid NOT NULL REFERENCES team_matchups(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  lineup_data jsonb NOT NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  submitted_at timestamptz DEFAULT now(),
  locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(matchup_id, division_id)
);

ALTER TABLE lineup_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lineup submissions in their organization"
  ON lineup_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE d.id = lineup_submissions.division_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Captains can manage their team lineups"
  ON lineup_submissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_teams lt
      WHERE lt.division_id = lineup_submissions.division_id
      AND lt.user_id = auth.uid()
      AND lt.is_captain = true
    )
    OR
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN seasons s ON s.id = d.season_id
      JOIN user_roles ur ON ur.organization_id = s.organization_id
      WHERE d.id = lineup_submissions.division_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'organizer')
    )
  );

CREATE INDEX IF NOT EXISTS idx_lineup_submissions_matchup ON lineup_submissions(matchup_id);
CREATE INDEX IF NOT EXISTS idx_lineup_submissions_division ON lineup_submissions(division_id);
