-- Add team_format to tournaments: 'singles' (1 player per team) or 'doubles' (2 players per team)
-- Default 'doubles' for backward compatibility with existing tournaments
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS team_format text NOT NULL DEFAULT 'doubles'
  CHECK (team_format IN ('singles', 'doubles'));

COMMENT ON COLUMN tournaments.team_format IS 'singles = 1 player per team, doubles = 2 players per team';
