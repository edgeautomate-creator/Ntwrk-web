/*
  # Update Tournament Match Scores Trigger for Games Won

  1. Changes
    - Modify `calculate_tournament_match_scores()` function to calculate games_won instead of overwriting scores
    - Preserve team1_score and team2_score values (these represent game points from frontend)
    - Calculate team1_games_won and team2_games_won based on individual game results
    - Determine winner_team_id based on games_won comparison
    
  2. Notes
    - This allows the frontend to send game points in team1_score/team2_score
    - The trigger automatically calculates who won each game
    - Winner determination is based on games won, not total points
*/

-- Drop all triggers first
DROP TRIGGER IF EXISTS update_tournament_match_scores_trigger ON tournament_matches;
DROP TRIGGER IF EXISTS calculate_match_scores_trigger ON tournament_matches;

-- Drop the function with CASCADE to remove dependent objects
DROP FUNCTION IF EXISTS calculate_tournament_match_scores() CASCADE;

-- Create updated function
CREATE OR REPLACE FUNCTION calculate_tournament_match_scores()
RETURNS TRIGGER AS $$
DECLARE
  v_team1_games_won INTEGER := 0;
  v_team2_games_won INTEGER := 0;
  v_winner_id UUID := NULL;
BEGIN
  -- Calculate games won based on individual game scores
  -- Game 1
  IF NEW.game1_team1_points IS NOT NULL AND NEW.game1_team2_points IS NOT NULL THEN
    IF NEW.game1_team1_points > NEW.game1_team2_points THEN
      v_team1_games_won := v_team1_games_won + 1;
    ELSIF NEW.game1_team2_points > NEW.game1_team1_points THEN
      v_team2_games_won := v_team2_games_won + 1;
    END IF;
  END IF;

  -- Game 2
  IF NEW.game2_team1_points IS NOT NULL AND NEW.game2_team2_points IS NOT NULL THEN
    IF NEW.game2_team1_points > NEW.game2_team2_points THEN
      v_team1_games_won := v_team1_games_won + 1;
    ELSIF NEW.game2_team2_points > NEW.game2_team1_points THEN
      v_team2_games_won := v_team2_games_won + 1;
    END IF;
  END IF;

  -- Game 3
  IF NEW.game3_team1_points IS NOT NULL AND NEW.game3_team2_points IS NOT NULL THEN
    IF NEW.game3_team1_points > NEW.game3_team2_points THEN
      v_team1_games_won := v_team1_games_won + 1;
    ELSIF NEW.game3_team2_points > NEW.game3_team1_points THEN
      v_team2_games_won := v_team2_games_won + 1;
    END IF;
  END IF;

  -- Game 4
  IF NEW.game4_team1_points IS NOT NULL AND NEW.game4_team2_points IS NOT NULL THEN
    IF NEW.game4_team1_points > NEW.game4_team2_points THEN
      v_team1_games_won := v_team1_games_won + 1;
    ELSIF NEW.game4_team2_points > NEW.game4_team1_points THEN
      v_team2_games_won := v_team2_games_won + 1;
    END IF;
  END IF;

  -- Game 5
  IF NEW.game5_team1_points IS NOT NULL AND NEW.game5_team2_points IS NOT NULL THEN
    IF NEW.game5_team1_points > NEW.game5_team2_points THEN
      v_team1_games_won := v_team1_games_won + 1;
    ELSIF NEW.game5_team2_points > NEW.game5_team1_points THEN
      v_team2_games_won := v_team2_games_won + 1;
    END IF;
  END IF;

  -- Set games won
  NEW.team1_games_won := v_team1_games_won;
  NEW.team2_games_won := v_team2_games_won;

  -- Determine winner based on games won
  IF v_team1_games_won > v_team2_games_won THEN
    v_winner_id := NEW.team1_id;
  ELSIF v_team2_games_won > v_team1_games_won THEN
    v_winner_id := NEW.team2_id;
  ELSE
    v_winner_id := NULL; -- Tie or incomplete
  END IF;

  -- Preserve manually set winner_team_id if games are tied or no clear winner yet
  IF NEW.winner_team_id IS NOT NULL AND v_winner_id IS NULL THEN
    -- Keep the existing winner
    NULL;
  ELSE
    NEW.winner_team_id := v_winner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER calculate_match_scores_trigger
  BEFORE INSERT OR UPDATE ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION calculate_tournament_match_scores();