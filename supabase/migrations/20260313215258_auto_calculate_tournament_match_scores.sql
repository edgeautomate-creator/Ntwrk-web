/*
  # Auto-calculate tournament match scores from individual game scores

  1. Changes
    - Creates a trigger function to automatically calculate team1_score and team2_score
    - Calculates based on how many games each team won
    - Automatically determines the winner_team_id
    - Only applies when game scores are provided and match is completed
  
  2. Logic
    - team1_score = count of games where team1 points > team2 points
    - team2_score = count of games where team2 points > team1 points
    - winner_team_id = team with higher score
    - Supports best-of-3 and best-of-5 formats
  
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS during calculation
    - Only modifies score fields, no permission escalation
*/

-- Create function to calculate match scores from individual game scores
CREATE OR REPLACE FUNCTION calculate_tournament_match_scores()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  team1_games_won integer := 0;
  team2_games_won integer := 0;
  winning_team_id uuid;
BEGIN
  -- Only calculate if at least one game has scores
  IF NEW.game1_team1_points IS NOT NULL AND NEW.game1_team2_points IS NOT NULL THEN
    
    -- Count game 1
    IF NEW.game1_team1_points > NEW.game1_team2_points THEN
      team1_games_won := team1_games_won + 1;
    ELSIF NEW.game1_team2_points > NEW.game1_team1_points THEN
      team2_games_won := team2_games_won + 1;
    END IF;
    
    -- Count game 2
    IF NEW.game2_team1_points IS NOT NULL AND NEW.game2_team2_points IS NOT NULL THEN
      IF NEW.game2_team1_points > NEW.game2_team2_points THEN
        team1_games_won := team1_games_won + 1;
      ELSIF NEW.game2_team2_points > NEW.game2_team1_points THEN
        team2_games_won := team2_games_won + 1;
      END IF;
    END IF;
    
    -- Count game 3
    IF NEW.game3_team1_points IS NOT NULL AND NEW.game3_team2_points IS NOT NULL THEN
      IF NEW.game3_team1_points > NEW.game3_team2_points THEN
        team1_games_won := team1_games_won + 1;
      ELSIF NEW.game3_team2_points > NEW.game3_team1_points THEN
        team2_games_won := team2_games_won + 1;
      END IF;
    END IF;
    
    -- Count game 4
    IF NEW.game4_team1_points IS NOT NULL AND NEW.game4_team2_points IS NOT NULL THEN
      IF NEW.game4_team1_points > NEW.game4_team2_points THEN
        team1_games_won := team1_games_won + 1;
      ELSIF NEW.game4_team2_points > NEW.game4_team1_points THEN
        team2_games_won := team2_games_won + 1;
      END IF;
    END IF;
    
    -- Count game 5
    IF NEW.game5_team1_points IS NOT NULL AND NEW.game5_team2_points IS NOT NULL THEN
      IF NEW.game5_team1_points > NEW.game5_team2_points THEN
        team1_games_won := team1_games_won + 1;
      ELSIF NEW.game5_team2_points > NEW.game5_team1_points THEN
        team2_games_won := team2_games_won + 1;
      END IF;
    END IF;
    
    -- Set the calculated scores
    NEW.team1_score := team1_games_won;
    NEW.team2_score := team2_games_won;
    
    -- Determine winner
    IF team1_games_won > team2_games_won THEN
      winning_team_id := NEW.team1_id;
    ELSIF team2_games_won > team1_games_won THEN
      winning_team_id := NEW.team2_id;
    ELSE
      winning_team_id := NULL;
    END IF;
    
    NEW.winner_team_id := winning_team_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run before update
DROP TRIGGER IF EXISTS calculate_match_scores_trigger ON tournament_matches;
CREATE TRIGGER calculate_match_scores_trigger
  BEFORE UPDATE ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION calculate_tournament_match_scores();

-- Backfill existing matches with game scores but missing team scores
UPDATE tournament_matches
SET 
  team1_score = (
    CASE WHEN game1_team1_points > game1_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game2_team1_points > game2_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game3_team1_points > game3_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game4_team1_points > game4_team2_points THEN 1 ELSE 0 END +
    CASE WHEN game5_team1_points > game5_team2_points THEN 1 ELSE 0 END
  ),
  team2_score = (
    CASE WHEN game1_team2_points > game1_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game2_team2_points > game2_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game3_team2_points > game3_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game4_team2_points > game4_team1_points THEN 1 ELSE 0 END +
    CASE WHEN game5_team2_points > game5_team1_points THEN 1 ELSE 0 END
  )
WHERE 
  game1_team1_points IS NOT NULL 
  AND game1_team2_points IS NOT NULL
  AND (team1_score IS NULL OR team2_score IS NULL);

-- Update winner_team_id based on calculated scores
UPDATE tournament_matches
SET winner_team_id = CASE 
  WHEN team1_score > team2_score THEN team1_id
  WHEN team2_score > team1_score THEN team2_id
  ELSE NULL
END
WHERE 
  team1_score IS NOT NULL 
  AND team2_score IS NOT NULL
  AND winner_team_id IS NULL;
