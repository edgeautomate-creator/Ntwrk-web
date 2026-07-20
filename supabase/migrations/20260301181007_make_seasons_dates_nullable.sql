/*
  # Make Season Dates Nullable

  ## Overview
  This migration makes the start_date and end_date columns in the seasons table nullable
  to allow creating leagues without specific dates set initially.

  ## Changes
  - Make `start_date` nullable in seasons table
  - Make `end_date` nullable in seasons table (already nullable, but ensure it)

  ## Rationale
  Users should be able to create leagues without immediately setting dates,
  and add them later when they're ready to start the season.
*/

-- Make start_date nullable
ALTER TABLE seasons 
ALTER COLUMN start_date DROP NOT NULL;

-- Ensure end_date is nullable (it should already be)
ALTER TABLE seasons 
ALTER COLUMN end_date DROP NOT NULL;
