# Quick League System Test

## Quick Verification (5 minutes)

### 1. Create a Test League

1. Go to `/dashboard/leagues`
2. Click "Create League"
3. Fill in:
   - Name: "Quick Test League"
   - Type: Non-DUPR
   - Teams: 4
   - Players per team: 2
4. Name teams: Alpha, Bravo, Charlie, Delta
5. Keep default scoring settings
6. Complete the wizard

**Expected:** League created, redirected to league page showing 4 teams

### 2. Test Player Registration

1. Click on "Alpha" team
2. Click "Claim Slot" button
3. Verify you appear in the roster as Captain
4. Copy the invite link at the bottom
5. Open link in new tab/window
6. Click "Join Team"

**Expected:** Second player joins successfully, roster shows 2 players

### 3. Verify Database

Run in Supabase SQL Editor:

```sql
-- Check recent league
SELECT
  l.name,
  COUNT(DISTINCT d.id) as teams,
  COUNT(DISTINCT st.id) as standings,
  COUNT(DISTINCT lw.id) as weeks,
  COUNT(DISTINCT tm.id) as matchups
FROM leagues l
LEFT JOIN seasons s ON s.league_id = l.id
LEFT JOIN divisions d ON d.season_id = s.id
LEFT JOIN standings st ON st.team_id = d.id
LEFT JOIN league_weeks lw ON lw.season_id = s.id
LEFT JOIN team_matchups tm ON tm.league_week_id = lw.id
WHERE l.created_at > NOW() - INTERVAL '1 hour'
GROUP BY l.id, l.name;
```

**Expected Results:**
- teams: 4
- standings: 4
- weeks: 3 (for 4 teams in round-robin)
- matchups: 6 (each team plays 3 others)

### 4. Quick Status Check

```sql
-- Quick status of test league
SELECT
  d.name as team_name,
  COUNT(tp.id) as registered_players,
  st.matchup_wins,
  st.matchup_losses
FROM divisions d
LEFT JOIN team_players tp ON tp.team_id = d.id
LEFT JOIN standings st ON st.team_id = d.id
WHERE d.season_id = (
  SELECT s.id FROM seasons s
  JOIN leagues l ON l.id = s.league_id
  ORDER BY l.created_at DESC
  LIMIT 1
)
GROUP BY d.id, d.name, st.matchup_wins, st.matchup_losses
ORDER BY d.name;
```

**Expected:** All 4 teams listed, some with registered players, all with 0-0 record

## If Tests Pass ✅

Your league system is working correctly! The implementation includes:

- ✅ League creation with full configuration
- ✅ Automatic team and standings generation
- ✅ Round-robin schedule creation
- ✅ Player registration system
- ✅ Team invite links
- ✅ Captain assignment
- ✅ Proper database relationships

## If Tests Fail ❌

### Issue: No matchups created

**Check:**
```sql
SELECT * FROM league_weeks
WHERE season_id = (
  SELECT id FROM seasons ORDER BY created_at DESC LIMIT 1
);
```

If empty, there's an RLS policy issue on league_weeks.

### Issue: Can't join team

**Check:**
```sql
-- Test if you can insert manually
SELECT * FROM pg_policies
WHERE tablename = 'team_players' AND cmd = 'INSERT';
```

RLS policy might be too restrictive.

### Issue: Players not showing

**Check:**
```sql
SELECT
  tp.*,
  p.full_name
FROM team_players tp
LEFT JOIN profiles p ON p.user_id = tp.user_id
ORDER BY tp.created_at DESC
LIMIT 5;
```

If profiles are NULL, user might not have a profile record.

## Next: Full Testing

See `TESTING_GUIDE.md` for comprehensive testing instructions covering:
- Edge cases
- Multi-user scenarios
- Data integrity checks
- Common issues and solutions
