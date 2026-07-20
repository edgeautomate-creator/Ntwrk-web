/*
  # Create player_ratings table

  ## Summary
  Stores DUPR player rating data received via webhook events.
  Each player has one row, upserted on every incoming webhook.

  ## New Tables
  - `player_ratings`
    - `id` (bigserial, primary key)
    - `dupr_id` (text, unique, not null) — DUPR player identifier
    - `player_name` (text) — player's full name
    - `singles` (text) — current singles rating
    - `doubles` (text) — current doubles rating
    - `mixed` (text) — mixed doubles rating (new field)
    - `singles_reliability` (text)
    - `doubles_reliability` (text)
    - `singles_provisional` (text)
    - `doubles_provisional` (text)
    - `career_high_singles` (text) — new field
    - `career_high_doubles` (text) — new field
    - `age_rating_50_plus` (text) — new field
    - `age_rating_65_plus` (text) — new field
    - `wins` (int) — new field
    - `losses` (int) — new field
    - `match_id` (bigint) — match that triggered the update
    - `raw_payload` (jsonb) — full incoming webhook body for audit/replay
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz, auto-updated by trigger)

  ## Security
  - RLS enabled; only service role (edge function) can write
  - Authenticated users can read their own row via dupr_id match on profile
*/

-- Reusable trigger function (create only if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Main table
CREATE TABLE IF NOT EXISTS player_ratings (
  id                    BIGSERIAL       PRIMARY KEY,
  dupr_id               TEXT            NOT NULL UNIQUE,
  player_name           TEXT,

  -- Core ratings
  singles               TEXT,
  doubles               TEXT,
  mixed                 TEXT,

  -- Reliability scores
  singles_reliability   TEXT,
  doubles_reliability   TEXT,

  -- Provisional ratings
  singles_provisional   TEXT,
  doubles_provisional   TEXT,

  -- Career highs
  career_high_singles   TEXT,
  career_high_doubles   TEXT,

  -- Age-based ratings
  age_rating_50_plus    TEXT,
  age_rating_65_plus    TEXT,

  -- Win/loss record
  wins                  INT,
  losses                INT,

  -- Match that triggered this update
  match_id              BIGINT,

  -- Full raw webhook payload for audit and replay
  raw_payload           JSONB,

  -- Timestamps
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_player_ratings_updated_at'
  ) THEN
    CREATE TRIGGER set_player_ratings_updated_at
      BEFORE UPDATE ON player_ratings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Index for fast lookups by dupr_id
CREATE INDEX IF NOT EXISTS idx_player_ratings_dupr_id ON player_ratings (dupr_id);

-- Enable RLS
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

-- Service role (used by the edge function) bypasses RLS automatically.
-- Allow authenticated users to read their own rating row matched via profiles.
CREATE POLICY "Users can read own player rating"
  ON player_ratings
  FOR SELECT
  TO authenticated
  USING (
    dupr_id IN (
      SELECT dupr_user_id FROM profiles WHERE id = auth.uid()
    )
  );
