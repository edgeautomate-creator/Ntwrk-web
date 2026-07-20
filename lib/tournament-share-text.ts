export function formatTournamentShareHeader(
  eventName: string,
  date: string | null | undefined,
  startTime: string | null | undefined,
): string {
  const name = eventName.trim() || 'Tournament';

  const dateStr = date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const timeStr = startTime
    ? new Date(`2000-01-01T${startTime}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  let text = `${name}\n`;
  if (dateStr) {
    text += timeStr ? `${dateStr} ${timeStr}\n` : `${dateStr}\n`;
  } else if (timeStr) {
    text += `${timeStr}\n`;
  }
  return text;
}

export interface StandingsShareRow {
  label: string;
  wins: number;
  losses: number;
  pointDifferential: number;
}

export function buildStandingsShareBlock(
  rows: StandingsShareRow[],
  completedGamesCount: number,
  totalPossibleGames: number,
): string {
  if (rows.length === 0) return '';

  let text = `Standings (${completedGamesCount}/${totalPossibleGames})\n\n`;
  for (const row of rows) {
    const diffStr = row.pointDifferential >= 0 ? `+${row.pointDifferential}` : String(row.pointDifferential);
    text += `${row.label}    ${row.wins}-${row.losses} ${diffStr}\n`;
  }
  return text;
}

const PLAYOFF_ROUND_ORDER = [
  'Round of 32',
  'Round of 16',
  'First Round',
  'Quarterfinals',
  'Semifinals',
  'Finals',
];

export function sortPlayoffRoundNames(rounds: string[]): string[] {
  return [...rounds].sort((a, b) => {
    const idxA = PLAYOFF_ROUND_ORDER.indexOf(a);
    const idxB = PLAYOFF_ROUND_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export interface GameScoreShare {
  team1Points: number;
  team2Points: number;
}

export interface PlayoffMatchShareRow {
  playoffRound: string;
  team1Label: string;
  team2Label: string;
  seed1?: number | null;
  seed2?: number | null;
  status: string;
  gameScores?: GameScoreShare[];
  team1GamesWon?: number | null;
  team2GamesWon?: number | null;
}

/** Extract per-game point scores from a match record (game1_team1_points, etc.). */
export function extractMatchGameScores(
  match: Record<string, unknown>,
  bestOf: number,
): GameScoreShare[] {
  const scores: GameScoreShare[] = [];
  for (let i = 1; i <= bestOf; i++) {
    const team1Points = match[`game${i}_team1_points`];
    const team2Points = match[`game${i}_team2_points`];
    if (team1Points != null && team2Points != null) {
      scores.push({
        team1Points: Number(team1Points),
        team2Points: Number(team2Points),
      });
    }
  }
  return scores;
}

function formatPlayoffMatchScore(match: PlayoffMatchShareRow): string {
  if (match.gameScores && match.gameScores.length > 0) {
    return match.gameScores.map((g) => `${g.team1Points}-${g.team2Points}`).join(', ');
  }
  if (match.status === 'completed') {
    return `${match.team1GamesWon ?? 0}-${match.team2GamesWon ?? 0}`;
  }
  return 'TBD';
}

export function buildPlayoffsShareBlock(
  matches: PlayoffMatchShareRow[],
  championLabel?: string | null,
): string {
  if (matches.length === 0) {
    let text = 'Playoffs\nNot started yet';
    if (championLabel) {
      text += `\n\n🏆 Champion: ${championLabel}`;
    }
    return text;
  }

  const byRound = matches.reduce(
    (acc, match) => {
      const round = match.playoffRound || 'Playoffs';
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    },
    {} as Record<string, PlayoffMatchShareRow[]>,
  );

  const sortedRounds = sortPlayoffRoundNames(Object.keys(byRound));
  let text = 'Playoffs\n\n';

  for (const round of sortedRounds) {
    text += `${round}\n`;
    for (const match of byRound[round]) {
      const seed1 = match.seed1 ? `#${match.seed1} ` : '';
      const seed2 = match.seed2 ? `#${match.seed2} ` : '';
      const vs = '  vs  ';
      if (match.status === 'completed') {
        const score = formatPlayoffMatchScore(match);
        text += `${seed1}${match.team1Label}${vs}${seed2}${match.team2Label}    ${score}\n`;
      } else {
        text += `${seed1}${match.team1Label}${vs}${seed2}${match.team2Label}    TBD\n`;
      }
    }
    text += '\n';
  }

  if (championLabel) {
    text += `🏆 Champion: ${championLabel}\n`;
  }

  return text.trimEnd();
}

export function buildPlayoffsAndStandingsShareText(
  header: string,
  standingsBlock: string,
  playoffsBlock: string,
): string {
  const parts = [header.trim()];
  if (standingsBlock.trim()) parts.push(standingsBlock.trim());
  if (playoffsBlock.trim()) parts.push(playoffsBlock.trim());
  return parts.join('\n\n');
}
