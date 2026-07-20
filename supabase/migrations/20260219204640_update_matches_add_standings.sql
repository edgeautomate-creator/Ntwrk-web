/*
  # Update Tournament Matches and Add Standings

  1. Changes to tournament_matches
    - Add `match_number` column for ordering
    - Add `status` column to track match state
    - Add `completed_at` timestamp
    - Update foreign keys to reference tournament_teams
    - Rename `winner_id` to `winner_team_id` for clarity
    - Rename `match_date` to `scheduled_time`
  
  2. New Table: team_standings
    - Tracks wins, losses, and statistics for each team
    - Automatically updated when matches are completed
    - Sorted by wins, then point differential

  3. Security
    - Maintain existing RLS policies
    - Anyone can view matches and standings
    - Authenticated users can update scores

  4. Important Notes
    - Standings are automatically calculated from match results
    - Trigger updates standings whenever a match is completed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'match_number'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN match_number integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'status'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'scheduled_time'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN scheduled_time timestamptz;
    UPDATE tournament_matches SET scheduled_time = match_date WHERE match_date IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'winner_team_id'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN winner_team_id uuid REFERENCES tournament_teams(id) ON DELETE SET NULL;
    UPDATE tournament_matches SET winner_team_id = winner_id WHERE winner_id IS NOT NULL;
  END IF;
END $$;

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

DROP POLICY IF EXISTS "Anyone can view team standings" ON team_standings;
CREATE POLICY "Anyone can view team standings"
  ON team_standings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "System can manage standings" ON team_standings;
CREATE POLICY "System can manage standings"
  ON team_standings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.team1_score IS NOT NULL AND NEW.team2_score IS NOT NULL THEN
    IF NEW.team1_score > NEW.team2_score THEN
      NEW.winner_team_id := NEW.team1_id;
    ELSIF NEW.team2_score > NEW.team1_score THEN
      NEW.winner_team_id := NEW.team2_id;
    END IF;

    NEW.completed_at := now();

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

CREATE INDEX IF NOT EXISTS idx_tournament_matches_match_number ON tournament_matches(tournament_id, match_number);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_team_standings_tournament ON team_standings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_team_standings_team ON team_standings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_standings_ranking ON team_standings(tournament_id, wins DESC, point_differential DESC);
