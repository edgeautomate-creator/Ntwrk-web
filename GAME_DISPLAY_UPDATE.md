# Game Display Update - Show All Games at Once

## Summary
Updated the tournament score submission system to display all games (Game 1, Game 2, Game 3, etc.) at once instead of revealing them sequentially. Users can now see the full match structure immediately but must still submit scores in order.

## Changes Made

### 1. GameScoreInput Component (`components/game-score-input.tsx`)
**New Props:**
- `isPreviousGameComplete?: boolean` - Indicates if the previous game has been completed
- `matchDecided?: boolean` - Indicates if the match outcome is already determined

**Key Features:**
- Displays all games from the start
- Shows "Complete Game X first" message for games that cannot be submitted yet
- Prevents out-of-order score submission (must complete Game 1 before Game 2, etc.)
- Shows "Not Needed" badge for games after match is decided (e.g., Game 3 in a 2-0 Best of 3)
- Creators can still edit/update any game regardless of order
- Visual states:
  - **Completed games**: Green badge with checkmark, scores displayed
  - **Pending games**: Empty inputs with submit button
  - **Blocked games**: Grayed out with message to complete previous game
  - **Not needed games**: Grayed out with "Match already decided" message

### 2. Round Robin Page (`app/dashboard/tournaments/[id]/king-of-the-hill-page.tsx`)
**Updated Score Dialog:**
- Removed `shouldShow` conditional logic that hid games
- All games (1 through `best_of`) now render immediately
- Added `isPreviousGameComplete` calculation for each game
- Passes `matchDecided` flag to show which games aren't needed

**Logic:**
```typescript
const isPreviousGameComplete = gameNum === 1 || (
  selectedMatch[`game${previousGameNum}_team1_points`] !== null &&
  selectedMatch[`game${previousGameNum}_team2_points`] !== null
);
```

### 3. Main Tournament Page (`app/dashboard/tournaments/[id]/page.tsx`)
**Updated Score Dialog:**
- Applied same changes as Round Robin page
- All games display from the start
- Sequential submission validation in place
- Clear visual feedback on game status

## User Experience Improvements

### Before:
- Only showed Game 1 initially
- Game 2 appeared after submitting Game 1
- Game 3 appeared after submitting Game 2
- Users couldn't see full match structure upfront

### After:
- All games (1, 2, 3, etc.) visible immediately
- Users see complete match structure (Best of 3, Best of 5)
- Cannot skip games - must submit in order
- Clear messaging: "Complete Game 2 first" prevents confusion
- Visual indicators show which games are completed, pending, or not needed

## Match Flow Examples

### Best of 3 Match - Standard Flow:
1. **Initial state**: Game 1, 2, 3 all visible
2. **Submit Game 1**: Game 1 shows completed, Game 2 enabled, Game 3 blocked
3. **Submit Game 2**:
   - If match tied (1-1): All games completed/enabled
   - If match decided (2-0): Game 3 shows "Not Needed"

### Best of 5 Match - 3-0 Victory:
1. Games 1-5 all visible from start
2. Submit Game 1, 2, 3 sequentially
3. After 3-0 lead: Games 4 and 5 show "Not Needed" badge

## Backwards Compatibility
- Existing matches with completed games display correctly
- All games show with proper completion status
- No data migration required
- Scoring logic unchanged

## Creator Privileges
Tournament creators retain ability to:
- Edit completed game scores
- Update scores in any order
- Record additional games even after match decided

## Technical Notes
- No database changes required
- Frontend-only update
- Build passes without errors
- All existing functionality preserved
