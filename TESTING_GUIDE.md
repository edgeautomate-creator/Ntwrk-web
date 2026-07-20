# League System Testing Guide

This guide will help you test the complete league creation and player registration flow.

## Prerequisites

Before testing, ensure:
1. You are logged in to the application
2. Your user has an 'admin' or 'organizer' role in an organization
3. The database schema has been updated with the latest migration

## Test 1: Create a New League

### Steps:

1. **Navigate to League Creation**
   - Go to `/dashboard/leagues`
   - Click the "Create League" button

2. **Step 1: Basic Information**
   - Enter a league name (e.g., "Test Spring League 2026")
   - Select league type (DUPR or Non-DUPR)
   - Set number of teams (try 6 teams for a good test)
   - Set players per team (e.g., 2 for doubles)
   - Click "Next"

3. **Step 2: Team Names**
   - Enter unique names for each team (e.g., "Warriors", "Tigers", "Eagles", etc.)
   - Ensure no duplicate names
   - Click "Next"

4. **Step 3: Scoring & Format**
   - Configure game format (rally scoring recommended)
   - Set matches per matchup (e.g., 3)
   - Set game points (e.g., 11 points)
   - Enable/disable tiebreaker as desired
   - Click "Next"

5. **Step 4: Schedule & Playoffs**
   - Set regular season weeks
   - Set number of playoff teams (0 for no playoffs)
   - Click "Next"

6. **Step 5: Advanced Settings**
   - Configure lineup submission rules
   - Enable/disable substitutes
   - Click "Create League"

### Expected Results:

✅ League is created successfully
✅ You are redirected to the league detail page
✅ All teams are listed in the standings with 0-0 records
✅ Schedule shows matchups for each week
✅ No errors in the browser console

### Verification Queries:

Run these queries in Supabase SQL Editor to verify:

```sql
-- Check if league was created
SELECT l.name, s.name as season_name, COUNT(d.id) as team_count
FROM leagues l
JOIN seasons s ON s.league_id = l.id
LEFT JOIN divisions d ON d.season_id = s.id
WHERE l.name = 'Test Spring League 2026'
GROUP BY l.id, l.name, s.name;

-- Check if standings were created correctly
SELECT d.name as team_name, st.matchup_wins, st.matchup_losses
FROM divisions d
JOIN standings st ON st.team_id = d.id
WHERE d.season_id = (
  SELECT s.id FROM seasons s
  JOIN leagues l ON l.id = s.league_id
  WHERE l.name = 'Test Spring League 2026'
)
ORDER BY d.name;

-- Check if schedule was created
SELECT lw.week_number, COUNT(tm.id) as matchup_count
FROM league_weeks lw
LEFT JOIN team_matchups tm ON tm.league_week_id = lw.id
WHERE lw.season_id = (
  SELECT s.id FROM seasons s
  JOIN leagues l ON l.id = s.league_id
  WHERE l.name = 'Test Spring League 2026'
)
GROUP BY lw.week_number
ORDER BY lw.week_number;
```

## Test 2: Player Registration Flow

### Steps:

1. **View Team Details**
   - From the league page, click on any team name
   - You should see the team roster page with empty slots

2. **Join as First Player (Captain)**
   - Click "Claim Slot" on position 1
   - You should be automatically registered as captain
   - Your name should appear in the roster with "(Captain)" badge

3. **Share Invite Link**
   - Copy the invite link shown at the bottom
   - Open in a new browser window/incognito (or share with another user)

4. **Join as Second Player**
   - Log in as a different user (or use the same user to test)
   - Paste the invite link in browser
   - Click "Join Team"
   - You should be redirected to the team page
   - Your name should appear in the roster

5. **Verify Multiple Teams**
   - Repeat the process for 2-3 different teams
   - Ensure each team can have different players

### Expected Results:

✅ Players can successfully claim slots on teams
✅ First player is automatically marked as captain
✅ Invite links work correctly
✅ Team roster displays all registered players
✅ Player positions are tracked (1, 2, 3, etc.)
✅ Users cannot join the same team twice
✅ Teams become "full" when all slots are claimed

### Verification Queries:

```sql
-- Check team player registrations
SELECT
  d.name as team_name,
  tp.player_position,
  tp.is_captain,
  p.full_name as player_name,
  tp.joined_at
FROM team_players tp
JOIN divisions d ON d.id = tp.team_id
LEFT JOIN profiles p ON p.user_id = tp.user_id
WHERE d.season_id = (
  SELECT s.id FROM seasons s
  JOIN leagues l ON l.id = s.league_id
  WHERE l.name = 'Test Spring League 2026'
)
ORDER BY d.name, tp.player_position;
```

## Test 3: League Operations

### Steps:

1. **View Schedule**
   - Go to league detail page
   - Click "Schedule" tab
   - Verify all matchups are displayed correctly
   - Check that teams don't play themselves

2. **View Standings**
   - Click "Standings" tab
   - Verify all teams are listed
   - Confirm records start at 0-0

3. **Navigate Between Pages**
   - Test navigation from league → team → back to league
   - Test navigation from dashboard → leagues → specific league
   - Ensure no broken links

### Expected Results:

✅ Schedule displays all weeks with correct matchups
✅ Standings show all teams with initial 0-0 records
✅ Navigation works smoothly without errors
✅ Team names are consistent across all views

## Test 4: Edge Cases

### Test Multiple Users:

1. **User Without Role**
   - Try accessing league creation page
   - Should be blocked or redirected

2. **Full Team**
   - Fill all slots on a team
   - Verify no additional "Claim Slot" buttons appear
   - Try joining via invite link - should show "Team is Full"

3. **Leave Team**
   - Join a team as a player
   - Click "Leave Team" button
   - Verify you're removed from roster
   - Verify slot becomes available again

4. **Captain Leave**
   - Have captain leave the team
   - Verify captain status handling (captain field may need manual reassignment)

### Expected Results:

✅ Proper permissions are enforced
✅ Full teams prevent new registrations
✅ Players can leave and rejoin teams
✅ UI updates correctly when roster changes

## Test 5: Data Integrity

### Verification Queries:

```sql
-- Check for orphaned records
SELECT 'Standings without teams' as issue, COUNT(*) as count
FROM standings st
WHERE NOT EXISTS (SELECT 1 FROM divisions d WHERE d.id = st.team_id)
UNION ALL
SELECT 'Teams without seasons', COUNT(*)
FROM divisions d
WHERE NOT EXISTS (SELECT 1 FROM seasons s WHERE s.id = d.season_id)
UNION ALL
SELECT 'Matchups without weeks', COUNT(*)
FROM team_matchups tm
WHERE NOT EXISTS (SELECT 1 FROM league_weeks lw WHERE lw.id = tm.league_week_id);

-- Check foreign key integrity for team_players
SELECT 'Team players with invalid team_id' as issue, COUNT(*) as count
FROM team_players tp
WHERE NOT EXISTS (SELECT 1 FROM divisions d WHERE d.id = tp.team_id)
UNION ALL
SELECT 'Team players with invalid user_id', COUNT(*)
FROM team_players tp
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = tp.user_id);
```

### Expected Results:

✅ All counts should be 0 (no orphaned records)
✅ All foreign keys are valid
✅ No data integrity issues

## Common Issues & Solutions

### Issue: League Creation Fails

**Symptoms:** Error message during creation, no redirect
**Solution:**
- Check browser console for errors
- Verify user has correct role in organization
- Check RLS policies on leagues, seasons, divisions, and standings tables

### Issue: Can't Join Team

**Symptoms:** "Claim Slot" button doesn't work, error on join
**Solution:**
- Verify team_players RLS policies allow INSERT
- Check that user is in the same organization as the league
- Ensure team is not already full

### Issue: Schedule Not Created

**Symptoms:** No matchups appear in schedule tab
**Solution:**
- Check if league_weeks were created
- Verify team_matchups RLS policies
- Check browser console for JavaScript errors during creation

### Issue: Players Not Showing in Roster

**Symptoms:** Registered but not visible
**Solution:**
- Check team_players SELECT policy
- Verify profiles table has data for the user
- Check if query in TeamRegistration component is correct

## Database Schema Reference

### Key Tables:

- **leagues**: Top-level league information
- **seasons**: League season settings
- **divisions**: Team data (legacy naming - this is actually teams)
- **standings**: Team standings and records
- **league_weeks**: Weekly schedule structure
- **team_matchups**: Individual team matchups per week
- **team_players**: Player registrations to teams

### Key Relationships:

```
leagues (1) → (N) seasons
seasons (1) → (N) divisions (teams)
divisions (1) → (1) standings
seasons (1) → (N) league_weeks
league_weeks (1) → (N) team_matchups
divisions (1) → (N) team_players
```

## Success Criteria

Your league system is working correctly if:

1. ✅ Leagues can be created with all settings
2. ✅ Teams are automatically generated
3. ✅ Standings are initialized for all teams
4. ✅ Round-robin schedule is generated
5. ✅ Players can register to teams via invite links
6. ✅ Team rosters display correctly
7. ✅ Captain is automatically assigned to first player
8. ✅ Full teams prevent new registrations
9. ✅ All navigation works without errors
10. ✅ Database integrity is maintained

## Next Steps After Testing

Once all tests pass:

1. Test match score submission (if implemented)
2. Test standings updates after match results
3. Test playoff bracket generation (if enabled)
4. Test substitute player functionality (if enabled)
5. Test DUPR integration (if using DUPR leagues)

## Reporting Issues

If you find issues during testing:

1. Note the exact steps to reproduce
2. Check browser console for errors
3. Check network tab for failed API calls
4. Run verification queries to check database state
5. Document expected vs actual behavior
