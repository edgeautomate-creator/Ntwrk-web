/*
  # Add Score Confirmation System to Tournament Matches

  ## Summary
  Adds a confirmation workflow to tournament match scores so that scores submitted
  by participants sit in a "Pending" state until explicitly confirmed by the creator
  (for non-DUPR tournaments) or automatically confirmed when synced to DUPR.

  ## Changes

  ### Modified Tables
  - `tournament_matches`
    - `is_score_confirmed` (boolean, default false) — tracks whether submitted scores
      have been confirmed/finalized
    - `score_submitted_by` (uuid, nullable, references profiles.id) — tracks who last
      submitted scores, used for showing "submitted by [name]" in the UI

  ## Security
  - No RLS changes in this migration (handled in next migration)
  - The columns are nullable/defaulted safely so existing rows are unaffected

  ## Notes
  1. Existing completed matches will have is_score_confirmed = false until confirmed
  2. score_submitted_by uses ON DELETE SET NULL so deleting a user profile does not
     break match records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'is_score_confirmed'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN is_score_confirmed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'score_submitted_by'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN score_submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
