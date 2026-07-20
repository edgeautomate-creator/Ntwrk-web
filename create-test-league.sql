-- Test League Setup Script
-- This creates a test league with 4 teams for testing match scoring functionality
-- Run this after logging in to the app

-- First, get your user ID and organization
-- Replace YOUR_USER_ID and YOUR_ORG_ID with actual values from your session

DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_league_id uuid;
  v_season_id uuid;
  v_team1_id uuid;
  v_team2_id uuid;
  v_team3_id uuid;
  v_team4_id uuid;
BEGIN
  -- Get the first user (assumes you're logged in)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- Get their organization
  SELECT organization_id INTO v_org_id FROM user_roles WHERE user_id = v_user_id LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found for user. Please create an organization first.';
  END IF;

  RAISE NOTICE 'Using user: % and organization: %', v_user_id, v_org_id;

  -- Create test league
  INSERT INTO leagues (organization_id, name, description, created_by)
  VALUES (
    v_org_id,
    'Test Spring League 2026',
    'A test league with 4 teams for testing match scoring functionality',
    v_user_id
  )
  RETURNING id INTO v_league_id;

  RAISE NOTICE 'Created league: %', v_league_id;

  -- Create season
  INSERT INTO seasons (league_id, organization_id, name, best_of, created_by)
  VALUES (
    v_league_id,
    v_org_id,
    'Spring 2026',
    3,
    v_user_id
  )
  RETURNING id INTO v_season_id;

  RAISE NOTICE 'Created season: %', v_season_id;

  -- Create Team 1: The Dink Masters
  INSERT INTO divisions (season_id, organization_id, name, format, skill_level, created_by)
  VALUES (
    v_season_id,
    v_org_id,
    'The Dink Masters',
    'doubles',
    'intermediate',
    v_user_id
  )
  RETURNING id INTO v_team1_id;

  -- Add you as captain of Team 1
  INSERT INTO team_players (team_id, user_id, organization_id, player_position, is_captain, is_substitute)
  VALUES (v_team1_id, v_user_id, v_org_id, 1, true, false);

  RAISE NOTICE 'Created Team 1: The Dink Masters (ID: %)', v_team1_id;

  -- Create Team 2: The Kitchen Crew
  INSERT INTO divisions (season_id, organization_id, name, format, skill_level, created_by)
  VALUES (
    v_season_id,
    v_org_id,
    'The Kitchen Crew',
    'doubles',
    'intermediate',
    v_user_id
  )
  RETURNING id INTO v_team2_id;

  RAISE NOTICE 'Created Team 2: The Kitchen Crew (ID: %)', v_team2_id;

  -- Create Team 3: Paddle Smashers
  INSERT INTO divisions (season_id, organization_id, name, format, skill_level, created_by)
  VALUES (
    v_season_id,
    v_org_id,
    'Paddle Smashers',
    'doubles',
    'intermediate',
    v_user_id
  )
  RETURNING id INTO v_team3_id;

  RAISE NOTICE 'Created Team 3: Paddle Smashers (ID: %)', v_team3_id;

  -- Create Team 4: Net Ninjas
  INSERT INTO divisions (season_id, organization_id, name, format, skill_level, created_by)
  VALUES (
    v_season_id,
    v_org_id,
    'Net Ninjas',
    'doubles',
    'intermediate',
    v_user_id
  )
  RETURNING id INTO v_team4_id;

  RAISE NOTICE 'Created Team 4: Net Ninjas (ID: %)', v_team4_id;

  -- Create match schedule
  -- Match 1: Team 1 vs Team 2
  INSERT INTO matches (season_id, organization_id, home_team_id, away_team_id, location, status, format, best_of)
  VALUES (v_season_id, v_org_id, v_team1_id, v_team2_id, 'Test Court Complex', 'scheduled', 'doubles', 3);

  -- Match 2: Team 3 vs Team 4
  INSERT INTO matches (season_id, organization_id, home_team_id, away_team_id, location, status, format, best_of)
  VALUES (v_season_id, v_org_id, v_team3_id, v_team4_id, 'Test Court Complex', 'scheduled', 'doubles', 3);

  -- Match 3: Team 1 vs Team 3
  INSERT INTO matches (season_id, organization_id, home_team_id, away_team_id, location, status, format, best_of)
  VALUES (v_season_id, v_org_id, v_team1_id, v_team3_id, 'Test Court Complex', 'scheduled', 'doubles', 3);

  -- Match 4: Team 2 vs Team 4
  INSERT INTO matches (season_id, organization_id, home_team_id, away_team_id, location, status, format, best_of)
  VALUES (v_season_id, v_org_id, v_team2_id, v_team4_id, 'Test Court Complex', 'scheduled', 'doubles', 3);

  -- Match 5: Team 1 vs Team 4
  INSERT INTO matches (season_id, organization_id, home_team_id, away_team_id, location, status, format, best_of)
  VALUES (v_season_id, v_org_id, v_team1_id, v_team4_id, 'Test Court Complex', 'scheduled', 'doubles', 3);

  -- Match 6: Team 2 vs Team 3
  INSERT INTO matches (season_id, organization_id, home_team_id, away_team_id, location, status, format, best_of)
  VALUES (v_season_id, v_org_id, v_team2_id, v_team3_id, 'Test Court Complex', 'scheduled', 'doubles', 3);

  RAISE NOTICE '✅ Test league created successfully!';
  RAISE NOTICE 'League ID: %', v_league_id;
  RAISE NOTICE 'Season ID: %', v_season_id;
  RAISE NOTICE 'Teams: 4 teams with 6 scheduled matches';
  RAISE NOTICE 'You are captain of: The Dink Masters';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Navigate to /dashboard/leagues/% to view the league', v_league_id;
  RAISE NOTICE '2. Add players to teams (4 main + subs)';
  RAISE NOTICE '3. Test entering match scores';

END $$;
