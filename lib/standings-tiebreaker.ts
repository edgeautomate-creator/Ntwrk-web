export interface HeadToHeadMatch {
  team1_id?: string | null;
  team2_id?: string | null;
  winner_team_id?: string | null;
  status?: string;
  is_playoff_match?: boolean;
}

export interface StandingsSortable {
  team_id?: string;
  player_id?: string;
  wins?: number;
  games_won?: number;
  point_differential: number;
}

function resolveEntityTeamId(entityId: string): string {
  if (entityId.endsWith('-p1') || entityId.endsWith('-p2')) {
    return entityId.slice(0, -3);
  }
  return entityId;
}

function getEntityTeamId(entry: StandingsSortable): string {
  if (entry.team_id) return entry.team_id;
  if (entry.player_id) return resolveEntityTeamId(entry.player_id);
  return '';
}

export function getHeadToHeadComparison(
  entityA: string,
  entityB: string,
  matches: HeadToHeadMatch[]
): number {
  const teamA = resolveEntityTeamId(entityA);
  const teamB = resolveEntityTeamId(entityB);
  if (!teamA || !teamB || teamA === teamB) return 0;

  let teamAWins = 0;
  let teamBWins = 0;

  for (const match of matches) {
    if (match.is_playoff_match) continue;
    if (match.status !== 'completed') continue;
    if (!match.team1_id || !match.team2_id) continue;

    const playedEachOther =
      (match.team1_id === teamA && match.team2_id === teamB) ||
      (match.team1_id === teamB && match.team2_id === teamA);

    if (!playedEachOther) continue;

    if (match.winner_team_id === teamA) teamAWins++;
    else if (match.winner_team_id === teamB) teamBWins++;
  }

  if (teamAWins > teamBWins) return -1;
  if (teamBWins > teamAWins) return 1;
  return 0;
}

export function compareStandingsByTiebreaker(
  a: StandingsSortable,
  b: StandingsSortable,
  matches: HeadToHeadMatch[],
  pointDifferentialFirst: boolean,
  primaryKey: 'wins' | 'games_won'
): number {
  const primaryA = a[primaryKey] ?? 0;
  const primaryB = b[primaryKey] ?? 0;
  if (primaryB !== primaryA) return primaryB - primaryA;

  const pointDiffDelta = b.point_differential - a.point_differential;
  const headToHead = getHeadToHeadComparison(
    getEntityTeamId(a),
    getEntityTeamId(b),
    matches
  );

  if (pointDifferentialFirst) {
    if (pointDiffDelta !== 0) return pointDiffDelta;
    if (headToHead !== 0) return headToHead;
  } else {
    if (headToHead !== 0) return headToHead;
    if (pointDiffDelta !== 0) return pointDiffDelta;
  }

  return 0;
}

export function sortTeamStandings<T extends StandingsSortable>(
  standings: T[],
  matches: HeadToHeadMatch[],
  pointDifferentialFirst = false
): T[] {
  return [...standings].sort((a, b) =>
    compareStandingsByTiebreaker(a, b, matches, pointDifferentialFirst, 'wins')
  );
}

export function sortPlayerStandings<T extends StandingsSortable>(
  standings: T[],
  matches: HeadToHeadMatch[],
  pointDifferentialFirst = false
): T[] {
  return [...standings].sort((a, b) =>
    compareStandingsByTiebreaker(a, b, matches, pointDifferentialFirst, 'games_won')
  );
}
