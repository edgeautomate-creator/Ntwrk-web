/*
  # Fix King of the Hill Score Submission

  1. Changes
    - Updates the update_team_standings_from_match() trigger to skip King of the Hill matches
    - King of the Hill uses player IDs (player1_id, player2_id, etc.) instead of team IDs
    - The trigger now checks if team1_id and team2_id are NULL before processing
    - If both are NULL, the trigger skips winner assignment and standings updates
    
  2. Reason
    - King of the Hill format sets team1_id and team2_id to NULL
    - The trigger was trying to set winner_team_id to NULL team IDs
    - This caused 409 Conflict errors when submitting scores
    - King of the Hill calculates standings on the client side from player performance
    
  3. Impact
    - King of the Hill matches can now have scores submitted without errors
    - Regular tournament formats continue to update team standings automatically
    - No data loss or functionality regression
*/

CREATE OR REPLACE FUNCTION update_team_standings_from_match()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip this trigger for King of the Hill format (where team1_id and team2_id are NULL)
  -- King of the Hill uses individual player tracking and calculates standings on the client
  IF NEW.team1_id IS NULL OR NEW.team2_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND NEW.team1_score IS NOT NULL AND NEW.team2_score IS NOT NULL THEN
    -- Only set winner if not already set (by calculate_match_scores_trigger)
    IF NEW.winner_team_id IS NULL THEN
      IF NEW.team1_score > NEW.team2_score THEN
        NEW.winner_team_id := NEW.team1_id;
      ELSIF NEW.team2_score > NEW.team1_score THEN
        NEW.winner_team_id := NEW.team2_id;
      END IF;
    END IF;

    -- Set completed timestamp if not already set
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;

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
$$;
