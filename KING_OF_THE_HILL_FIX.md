# King of the Hill Tournament Fixes

## Issues Fixed

### 1. Player Removal Functionality
**Problem:** The `removePlayer` function was trying to nullify player fields in the tournament_teams table instead of deleting the team record. This left orphaned team entries with null players.

**Solution:**
- Added a DELETE policy to the `tournament_teams` table allowing tournament creators to delete team registrations
- Updated the `removePlayer` function to delete the entire team record instead of nullifying fields
- Simplified the logic by removing the slot-based update approach

### 2. Schedule Generation UUID Error
**Problem:** When generating schedules, the system was using composite player IDs (format: `teamId-p1`) as UUID values in the `tournament_matches` table, causing a "invalid input syntax for type uuid" error.

**Root Cause:** King of the Hill tournaments store players with composite IDs combining the team UUID and a player suffix (e.g., `8c8a9e34-3b1c-4630-aa5d-b165966269bc-p1`). These composite strings cannot be inserted into UUID columns.

**Solution:**
- Modified `generateSchedule` to extract the team UUID from composite player IDs before inserting into the database
- Updated schedule generation to use `team1_id` and `team2_id` columns (which are proper UUID columns) instead of `player1_id`, `player2_id`, etc.
- Changed the data structure to store team UUIDs for both singles and doubles formats

### 3. Match Display and Standings
**Problem:** After changing to team-based IDs, the match display and standings calculation needed updates.

**Solution:**
- Updated the `KingOfTheHillMatch` interface to include both `team1_id`/`team2_id` and player fields
- Modified `calculateStandings` to map team IDs back to player IDs using the composite ID format
- Added `getTeamPlayers` helper function to retrieve all players associated with a team
- Updated `formatMatchTeams` to look up players by team ID and display their names correctly

## Database Changes

### Migration: add_tournament_teams_delete_policy.sql
```sql
CREATE POLICY "Tournament creators can delete teams"
  ON tournament_teams
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
      AND tournaments.created_by = auth.uid()
    )
  );
```

## Code Changes

### File: app/dashboard/tournaments/[id]/king-of-the-hill-page.tsx

1. **Interface Update:** Added `team1_id` and `team2_id` to `KingOfTheHillMatch` interface

2. **removePlayer Function:** Simplified to delete the entire team record
   ```typescript
   const { error } = await supabase
     .from('tournament_teams')
     .delete()
     .eq('id', teamId);
   ```

3. **generateSchedule Function:** Extract team UUID from composite player IDs
   ```typescript
   const playersList: Player[] = players.map(p => ({
     // Extract the team UUID from composite ID (teamId-p1 format)
     session_player_id: p.id.split('-')[0],
   }));
   ```

4. **calculateStandings Function:** Map team IDs to player IDs
   ```typescript
   const team1PlayerIds = players
     .filter(p => p.id.startsWith(match.team1_id + '-'))
     .map(p => p.id);
   ```

5. **formatMatchTeams Function:** Look up players by team ID
   ```typescript
   const getTeamPlayers = (teamId: string | null) => {
     if (!teamId) return [];
     return players.filter(p => p.id.startsWith(teamId + '-'));
   };
   ```

## Testing

To verify the fixes:

1. **Player Removal:**
   - Create a King of the Hill tournament
   - Add players
   - Remove a player before generating the schedule
   - Verify the player is completely removed and the team record is deleted

2. **Schedule Generation:**
   - Create a King of the Hill tournament with at least 2 players
   - Click "Generate Schedule"
   - Verify the schedule is created without UUID errors
   - Check that matches are properly displayed with player names

3. **Standings Calculation:**
   - Enter scores for completed matches
   - View the Standings tab
   - Verify player statistics are calculated correctly

## Technical Notes

- The King of the Hill format reuses the `tournament_teams` table designed for bracket tournaments
- Players are stored as team entries with composite IDs (teamId-p1, teamId-p2)
- The `tournament_matches` table requires proper UUID values in team columns
- All player lookups need to account for the composite ID format
