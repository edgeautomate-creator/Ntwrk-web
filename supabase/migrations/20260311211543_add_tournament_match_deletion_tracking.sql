/*
  # Add Tournament Match Deletion Tracking

  1. New Columns
    - `tournament_matches.deleted_at` (timestamptz, nullable) - Timestamp when match was deleted
    - `tournament_matches.deleted_by` (uuid, FK to auth.users) - User who deleted the match
    - `tournament_matches.dupr_deletion_status` (text) - Status of DUPR deletion ('pending', 'success', 'failed', 'not_applicable')
    - `tournament_matches.dupr_deletion_error` (text, nullable) - Error message if DUPR deletion failed

  2. Constraints
    - Check constraint on dupr_deletion_status to ensure valid values
    - Foreign key constraint on deleted_by to auth.users

  3. Indexes
    - Index on deleted_at for filtering active vs deleted matches
    - Index on tournament_id and deleted_at for efficient queries

  4. Changes
    - Adds soft delete capability to tournament matches
    - Tracks DUPR deletion status separately for async operations
    - Maintains audit trail of who deleted matches
*/

-- Add deletion tracking columns to tournament_matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_matches' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_matches' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_matches' AND column_name = 'dupr_deletion_status'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN dupr_deletion_status text DEFAULT 'not_applicable'
      CHECK (dupr_deletion_status IN ('pending', 'success', 'failed', 'not_applicable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_matches' AND column_name = 'dupr_deletion_error'
  ) THEN
    ALTER TABLE tournament_matches ADD COLUMN dupr_deletion_error text;
  END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tournament_matches_deleted_at 
  ON tournament_matches(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_deleted 
  ON tournament_matches(tournament_id, deleted_at);

-- Add comment explaining the deletion tracking
COMMENT ON COLUMN tournament_matches.deleted_at IS 
  'Soft delete timestamp. Non-null means match is deleted.';

COMMENT ON COLUMN tournament_matches.deleted_by IS 
  'User ID of the person who deleted the match. Must be tournament creator.';

COMMENT ON COLUMN tournament_matches.dupr_deletion_status IS 
  'Status of DUPR API deletion: pending (awaiting DUPR deletion), success (deleted from DUPR), failed (DUPR deletion failed), not_applicable (no DUPR match to delete)';

COMMENT ON COLUMN tournament_matches.dupr_deletion_error IS 
  'Error message if DUPR deletion failed. Used for troubleshooting and retry logic.';