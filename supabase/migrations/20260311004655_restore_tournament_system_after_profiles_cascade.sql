/*
  # Restore Tournament System After Profiles CASCADE Drop

  ## Overview
  The profiles table was dropped with CASCADE in migration 20260310194205,
  which automatically deleted all dependent tables including the entire tournament system.
  This migration restores all tournament-related tables with all enhancements.

  ## New Tables Restored

  ### `tournaments`
  Core tournament management table with all features:
  - `id` (uuid, primary key) - Unique tournament identifier
  - `name` (text, required) - Tournament name
  - `created_by` (uuid, required) - References profiles(id), tournament creator
  - `date` (date, optional) - Tournament date
  - `start_time` (time, optional) - Start time
  - `location` (text, optional) - Location
  - `expected_teams` (integer, 2-12) - Number of teams expected
  - `playoff_teams` (integer, 2-6) - Teams advancing to playoffs
  - `format` (text) - "round_robin" or "group_stage_playoffs"
  - `best_of` (integer, 1/3/5) - Match format
  - `team_format` (text) - "singles" or "doubles"
  - `is_private` (boolean) - Public or private tournament
  - `is_dupr_required` (boolean) - Require DUPR for participants
  - `access_code` (text, optional) - Password for private tournaments
  - `share_token` (uuid) - Unique token for shareable link
  - `dupr_club_id` (text, optional) - DUPR club ID
  - `dupr_club_name` (text, optional) - DUPR club name
  - `created_at` / `updated_at` - Timestamps

  ### `tournament_teams`
  Team roster management with player slots:
  - `id` (uuid, primary key)
  - `tournament_id` (uuid) - References tournaments
  - `team_number` (integer, 1-12) - Team position number
  - `team_name` (text, optional) - Custom team name
  - `player1_name` / `player1_dupr_id` / `player1_rating` - Player 1 info
  - `player2_name` / `player2_dupr_id` / `player2_rating` - Player 2 info
  - `claimed_by_user_id` (uuid, optional) - User who claimed team slot
  - `created_at` / `updated_at` - Timestamps

  ### `tournament_participants`
  Tracks tournament participation and approval status:
  - `id` (uuid, primary key)
  - `tournament_id` (uuid) - References tournaments
  - `user_id` (uuid) - References profiles(id)
  - `status` (text) - "approved", "pending", "rejected"
  - `joined_at` (timestamptz)

  ### `tournament_matches`
  Match results and scheduling:
  - `id` (uuid, primary key)
  - `tournament_id` (uuid) - References tournaments
  - `round` (text) - Match round identifier
  - `match_number` (integer) - Match ordering
  - `team1_id` / `team2_id` (uuid) - References tournament_teams
  - `team1_score` / `team2_score` (integer) - Match scores
  - `winner_team_id` (uuid, optional) - References tournament_teams
  - `status` (text) - "scheduled", "in_progress", "completed"
  - `scheduled_time` (timestamptz) - When match is scheduled
  - `completed_at` (timestamptz) - When match was completed
  - `dupr_match_id` (bigint) - DUPR API match ID
  - `dupr_match_identifier` (text) - DUPR match correlation ID
  - `created_at` - Timestamp

  ### `team_standings`
  Automatically calculated team standings:
  - `id` (uuid, primary key)
  - `tournament_id` (uuid) - References tournaments
  - `team_id` (uuid) - References tournament_teams
  - `matches_played` / `wins` / `losses` - Match statistics
  - `points_for` / `points_against` / `point_differential` - Scoring stats
  - `created_at` / `updated_at` - Timestamps

  ## Security (RLS Policies)

  ### Tournaments
  - Public tournaments viewable by all authenticated users
  - Private tournaments only viewable by participants and creator
  - Users can create tournaments
  - Creators can update/delete their tournaments

  ### Tournament Teams
  - Anyone can view tournament teams
  - Tournament creators can update any team in their tournament
  - Authenticated users can claim empty team slots
  - Users can update their claimed teams

  ### Tournament Participants
  - Anyone can view participants of public tournaments
  - Participants and creators can view private tournament participants
  - Users can request to join tournaments
  - Creators can update participant status

  ### Tournament Matches
  - Anyone can view matches of public tournaments
  - Participants can view private tournament matches
  - Creators can create matches
  - Participants and creators can update match scores

  ### Team Standings
  - Anyone can view team standings
  - System automatically manages standings

  ## Triggers
  - Auto-update team standings when matches are completed
  - Auto-calculate winner based on scores
  - Auto-set completed_at timestamp

  ## Indexes
  - Optimized for tournament listing, searching, and filtering
  - Foreign key indexes for performance
  - Composite indexes for standings ranking
*/

-- ============================================================================
-- 1. CREATE TOURNAMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date,
  start_time time,
  location text,
  expected_teams integer NOT NULL CHECK (expected_teams >= 2 AND expected_teams <= 12),
  playoff_teams integer NOT NULL CHECK (playoff_teams >= 2 AND playoff_teams <= 6),
  format text NOT NULL CHECK (format IN ('round_robin', 'group_stage_playoffs')),
  best_of integer NOT NULL CHECK (best_of IN (1, 3, 5)) DEFAULT 1,
  team_format text NOT NULL DEFAULT 'doubles' CHECK (team_format IN ('singles', 'doubles')),
  is_private boolean DEFAULT false,
  is_dupr_required boolean DEFAULT false,
  access_code text,
  share_token uuid DEFAULT gen_random_uuid(),
  dupr_club_id text,
  dupr_club_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN tournaments.team_format IS 'singles = 1 player per team, doubles = 2 players per team';

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CREATE TOURNAMENT TEAMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  team_number integer NOT NULL CHECK (team_number >= 1 AND team_number <= 12),
  team_name text,
  player1_name text,
  player1_dupr_id text,
  player1_rating numeric(4, 2),
  player2_name text,
  player2_dupr_id text,
  player2_rating numeric(4, 2),
  claimed_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, team_number)
);

ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE TOURNAMENT PARTICIPANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')) DEFAULT 'pending',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE TOURNAMENT MATCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  round text NOT NULL,
  match_number integer,
  team1_id uuid REFERENCES tournament_teams(id) ON DELETE CASCADE NOT NULL,
  team2_id uuid REFERENCES tournament_teams(id) ON DELETE CASCADE NOT NULL,
  team1_score integer DEFAULT 0,
  team2_score integer DEFAULT 0,
  winner_team_id uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  scheduled_time timestamptz,
  completed_at timestamptz,
  dupr_match_id bigint,
  dupr_match_identifier text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN tournament_matches.dupr_match_id IS 'DUPR API match id; used for GET /match/v1.0/{id} and update';
COMMENT ON COLUMN tournament_matches.dupr_match_identifier IS 'Unique identifier sent to DUPR create/update; stored for reuse';

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE TEAM STANDINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  matches_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  points_for integer NOT NULL DEFAULT 0,
  points_against integer NOT NULL DEFAULT 0,
  point_differential integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, team_id)
);

ALTER TABLE team_standings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. CREATE RLS POLICIES FOR TOURNAMENTS
-- ============================================================================

CREATE POLICY "Anyone can view public tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (is_private = false);

CREATE POLICY "Participants can view private tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (
    is_private = true AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM tournament_participants
        WHERE tournament_participants.tournament_id = tournaments.id
        AND tournament_participants.user_id = auth.uid()
        AND tournament_participants.status = 'approved'
      )
    )
  );

CREATE POLICY "Users can create tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update their tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can delete their tournaments"
  ON tournaments FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- 7. CREATE RLS POLICIES FOR TOURNAMENT TEAMS
-- ============================================================================

CREATE POLICY "Anyone can view tournament teams"
  ON tournament_teams
  FOR SELECT
  USING (true);

CREATE POLICY "Tournament creators can update teams in their tournament"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can claim empty team slots"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (claimed_by_user_id IS NULL)
  WITH CHECK (auth.uid() = claimed_by_user_id);

CREATE POLICY "Users can update their claimed teams"
  ON tournament_teams
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = claimed_by_user_id)
  WITH CHECK (auth.uid() = claimed_by_user_id);

CREATE POLICY "Tournament creators can insert teams"
  ON tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.created_by = auth.uid()
    )
  );

-- ============================================================================
-- 8. CREATE RLS POLICIES FOR TOURNAMENT PARTICIPANTS
-- ============================================================================

CREATE POLICY "Anyone can view participants of public tournaments"
  ON tournament_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.is_private = false
    )
  );

CREATE POLICY "Participants and creators can view private tournament participants"
  ON tournament_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND (
        tournaments.created_by = auth.uid() OR
        (tournament_participants.user_id = auth.uid() AND tournament_participants.status = 'approved')
      )
    )
  );

CREATE POLICY "Users can request to join tournaments"
  ON tournament_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creators can update participant status"
  ON tournament_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_participants.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );

-- ============================================================================
-- 9. CREATE RLS POLICIES FOR TOURNAMENT MATCHES
-- ============================================================================

CREATE POLICY "Anyone can view matches of public tournaments"
  ON tournament_matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_matches.tournament_id
      AND tournaments.is_private = false
    )
  );

CREATE POLICY "Participants can view private tournament matches"
  ON tournament_matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
      AND (
        t.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tournament_participants tp
          WHERE tp.tournament_id = t.id
          AND tp.user_id = auth.uid()
          AND tp.status = 'approved'
        )
      )
    )
  );

CREATE POLICY "Creators can create matches"
  ON tournament_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_matches.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );

CREATE POLICY "Participants can update match scores"
  ON tournament_matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
      AND (
        t.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tournament_participants tp
          WHERE tp.tournament_id = t.id
          AND tp.user_id = auth.uid()
          AND tp.status = 'approved'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_matches.tournament_id
      AND (
        t.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tournament_participants tp
          WHERE tp.tournament_id = t.id
          AND tp.user_id = auth.uid()
          AND tp.status = 'approved'
        )
      )
    )
  );

CREATE POLICY "Creators can delete matches"
  ON tournament_matches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_matches.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );

-- ============================================================================
-- 10. CREATE RLS POLICIES FOR TEAM STANDINGS
-- ============================================================================

CREATE POLICY "Anyone can view team standings"
  ON team_standings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can manage standings"
  ON team_standings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 11. CREATE TRIGGERS AND FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.team1_score IS NOT NULL AND NEW.team2_score IS NOT NULL THEN
    -- Determine winner
    IF NEW.team1_score > NEW.team2_score THEN
      NEW.winner_team_id := NEW.team1_id;
    ELSIF NEW.team2_score > NEW.team1_score THEN
      NEW.winner_team_id := NEW.team2_id;
    END IF;

    -- Set completed timestamp
    NEW.completed_at := now();

    -- Update standings for team 1
    INSERT INTO team_standings (tournament_id, team_id, matches_played, wins, losses, points_for, points_against, point_differential)
    VALUES (
      NEW.tournament_id,
      NEW.team1_id,
      1,
      CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      NEW.team1_score,
      NEW.team2_score,
      NEW.team1_score - NEW.team2_score
    )
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      losses = team_standings.losses + CASE WHEN NEW.team1_score < NEW.team2_score THEN 1 ELSE 0 END,
      points_for = team_standings.points_for + NEW.team1_score,
      points_against = team_standings.points_against + NEW.team2_score,
      point_differential = team_standings.point_differential + (NEW.team1_score - NEW.team2_score),
      updated_at = now();

    -- Update standings for team 2
    INSERT INTO team_standings (tournament_id, team_id, matches_played, wins, losses, points_for, points_against, point_differential)
    VALUES (
      NEW.tournament_id,
      NEW.team2_id,
      1,
      CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      NEW.team2_score,
      NEW.team1_score,
      NEW.team2_score - NEW.team1_score
    )
    ON CONFLICT (tournament_id, team_id)
    DO UPDATE SET
      matches_played = team_standings.matches_played + 1,
      wins = team_standings.wins + CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      losses = team_standings.losses + CASE WHEN NEW.team2_score < NEW.team1_score THEN 1 ELSE 0 END,
      points_for = team_standings.points_for + NEW.team2_score,
      points_against = team_standings.points_against + NEW.team1_score,
      point_differential = team_standings.point_differential + (NEW.team2_score - NEW.team1_score),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_team_standings ON tournament_matches;
CREATE TRIGGER trigger_update_team_standings
  BEFORE UPDATE ON tournament_matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed' OR OLD.team1_score IS DISTINCT FROM NEW.team1_score OR OLD.team2_score IS DISTINCT FROM NEW.team2_score))
  EXECUTE FUNCTION update_team_standings_from_match();

-- ============================================================================
-- 12. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Tournaments indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_tournaments_updated_at ON tournaments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date);
CREATE INDEX IF NOT EXISTS idx_tournaments_share_token ON tournaments(share_token);

-- Tournament teams indexes
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_claimed_by ON tournament_teams(claimed_by_user_id);

-- Tournament participants indexes
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user_id ON tournament_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_status ON tournament_participants(tournament_id, status);

-- Tournament matches indexes
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_match_number ON tournament_matches(tournament_id, match_number);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team1 ON tournament_matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_team2 ON tournament_matches(team2_id);

-- Team standings indexes
CREATE INDEX IF NOT EXISTS idx_team_standings_tournament ON team_standings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_team_standings_team ON team_standings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_standings_ranking ON team_standings(tournament_id, wins DESC, point_differential DESC);
