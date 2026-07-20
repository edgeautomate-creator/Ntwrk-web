# Tournament User Guide - Updated Interface

## Schedule Tab - Round Organization

### What's New
The Schedule tab now organizes matches by rounds with a tabbed interface, making it easier to focus on specific rounds.

### How to Use

1. **Navigate to Tournament**
   - Go to Dashboard → Tournaments
   - Click on your tournament

2. **View Schedule**
   - Click the "Schedule" tab
   - You'll see tabs for each round (Round 1, Round 2, Round 3, etc.)

3. **Switch Between Rounds**
   - Click on any round tab to view matches for that round
   - Matches are displayed in a clean 2-column grid (1 column on mobile)

4. **Understanding Match Cards**
   - **Top Section**: Match number and status badge
     - Green badge = Completed
     - Blue badge = In Progress
     - Gray badge = Scheduled
   - **Team Info**: Team name with player names below
   - **Scores**: Large numbers on the right side
   - **VS Indicator**: Circle in the middle showing it's a matchup

5. **Enter Scores**
   - Click anywhere on a match card
   - Score entry dialog opens
   - Enter scores and click submit
   - Standings update automatically

### Tips
- Start with Round 1 and work through sequentially
- Completed matches show green badges for easy tracking
- Use the round tabs to jump to specific weeks

## Playoffs Tab - Bracket View

### What's New
The Playoffs tab now displays a true tournament bracket similar to March Madness, showing the entire playoff structure at a glance.

### How to Use

1. **Access Playoffs**
   - Complete all regular season matches
   - Tournament creator clicks "Start Playoffs" button
   - Playoffs tab becomes available

2. **Navigate the Bracket**
   - Bracket displays horizontally (scroll left/right if needed)
   - Each column represents a playoff round:
     - First column: Quarterfinals (if 8 teams)
     - Middle column: Semifinals
     - Right column: Finals (marked with trophy icon)

3. **Understanding the Bracket**
   - **Team Cards**: Show team name and players
   - **Scores**: Displayed next to each team
   - **Winners**: Highlighted with green background
   - **Connectors**: Lines show progression between rounds
   - **Status**: Badge shows if match is pending or completed

4. **Enter Playoff Scores**
   - Click on any match in the bracket
   - Enter scores in the dialog
   - Winner advances automatically to next round
   - Finals winner becomes tournament champion

5. **Champion Display**
   - When Finals are complete
   - Champion banner appears at bottom
   - Shows trophy icon and team details

### Tips
- Scroll horizontally to see all rounds in large brackets
- Green highlighting shows which teams advanced
- Finals match marked with golden trophy icon
- Can't advance until previous round is complete

## Visual Guide

### Schedule Tab Layout
```
┌─────────────────────────────────────────┐
│  [Round 1] [Round 2] [Round 3]         │  ← Round Tabs
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐            │
│  │ Match 1  │  │ Match 2  │            │  ← Match Cards
│  │ Team A   │  │ Team C   │            │     (2 per row)
│  │ vs       │  │ vs       │            │
│  │ Team B   │  │ Team D   │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

### Playoffs Bracket Layout
```
┌────────────────────────────────────────────────────────┐
│  Quarterfinals  →  Semifinals  →    Finals 🏆         │
├────────────────────────────────────────────────────────┤
│  ┌─────┐           ┌─────┐          ┌─────┐          │
│  │ T1  │──┐        │ W1  │──┐       │ W3  │          │
│  └─────┘  │        └─────┘  │       └─────┘          │
│           ├───→              ├───→                    │
│  ┌─────┐  │        ┌─────┐  │       🏆 CHAMPION!    │
│  │ T2  │──┘        │ W2  │──┘                        │
│  └─────┘           └─────┘                            │
└────────────────────────────────────────────────────────┘
```

## Status Indicators

### Match Status Badges
- **Completed** (Green): Match finished, scores recorded
- **In Progress** (Blue): Match currently being played
- **Scheduled** (Gray): Match not yet played

### Visual Cues
- **Green Background**: Winner in playoffs
- **Green Border**: Winner highlight
- **Trophy Icon**: Finals round
- **Bold Scores**: Completed match scores
- **Dash (-)**: No score yet (pending match)

## Best Practices

### For Tournament Organizers

1. **Generate Schedule First**
   - Go to Teams tab
   - Click "Generate Schedule"
   - Review matches in Schedule tab

2. **Enter Scores Round by Round**
   - Complete all Round 1 matches
   - Move to Round 2, etc.
   - Keep standings updated for accurate playoffs

3. **Start Playoffs at Right Time**
   - Ensure all regular season matches complete
   - Verify top teams are correct
   - Click "Start Playoffs" button
   - Playoff bracket generates automatically

4. **Complete Playoffs in Order**
   - Finish all Quarterfinals before Semifinals
   - Finish Semifinals before Finals
   - Enter Finals score to crown champion

### For Players

1. **Check Your Matches**
   - Use round tabs to find your team
   - Note which round you're playing
   - Check match status

2. **Track Your Progress**
   - View Standings tab for current ranking
   - See if you qualify for playoffs
   - Check playoff bracket for your position

3. **Follow Tournament Progress**
   - Bracket view shows overall tournament status
   - See who's advancing in real-time
   - Watch for champion announcement

## Troubleshooting

### Can't See Round Tabs
- Schedule must be generated first
- Go to Teams tab → Generate Schedule

### Playoffs Tab Missing
- Tournament must have playoffs enabled
- Creator must click "Start Playoffs"
- Regular season must be complete

### Bracket Not Displaying Correctly
- Try horizontal scroll
- Refresh the page
- Check on desktop for full view (better for large brackets)

### Scores Not Updating
- Only tournament creator can enter scores
- Click directly on match card
- Ensure both scores are entered
- Check network connection

## Mobile Tips

1. **Round Tabs**: Swipe to see all tabs
2. **Match Cards**: Stack to 1 column on mobile
3. **Playoff Bracket**: Scroll horizontally with finger
4. **Better Experience**: Desktop recommended for playoffs

## What's Preserved

All existing functionality still works:
- Team registration
- Score entry dialogs
- Standings calculations
- Champion tracking
- Share links
- Access codes
- DUPR integration (if enabled)

Only the visual presentation changed for better organization!
