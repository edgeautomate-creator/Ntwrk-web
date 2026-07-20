import { generateTournamentRoundPairings } from '@/lib/schedule-generator';

export interface RebuildMatchLike {
  id: string;
  team1_id: string | null;
  team2_id: string | null;
  round: string | null;
  status: string;
  is_playoff_match?: boolean;
  game1_team1_points?: number | null;
  game1_team2_points?: number | null;
  game2_team1_points?: number | null;
  game2_team2_points?: number | null;
  game3_team1_points?: number | null;
  game3_team2_points?: number | null;
  game4_team1_points?: number | null;
  game4_team2_points?: number | null;
  game5_team1_points?: number | null;
  game5_team2_points?: number | null;
  group_name?: string | null;
  pool_name?: string | null;
}

export interface RebuildTeamLike {
  id: string;
  player1_name?: string | null;
  player2_name?: string | null;
  player1_user_id?: string | null;
  player2_user_id?: string | null;
  group_name?: string | null;
  pool_name?: string | null;
}

export interface PlannedMatchInsert {
  team1Id: string;
  team2Id: string;
  round: string;
  groupName?: string | null;
  poolName?: string | null;
}

export interface ScheduleRebuildPlan {
  lockedMatchIds: string[];
  matchIdsToSoftDelete: string[];
  matchesToInsert: PlannedMatchInsert[];
  lockedRoundCount: number;
  nextRoundStart: number;
  catchUpRoundLabel: string | null;
  summary: string;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function matchHasLockedResults(match: RebuildMatchLike): boolean {
  if (match.status === 'completed' || match.status === 'in_progress') return true;
  return (
    match.game1_team1_points != null ||
    match.game1_team2_points != null ||
    match.game2_team1_points != null ||
    match.game2_team2_points != null ||
    match.game3_team1_points != null ||
    match.game3_team2_points != null ||
    match.game4_team1_points != null ||
    match.game4_team2_points != null ||
    match.game5_team1_points != null ||
    match.game5_team2_points != null
  );
}

function parseRoundNumber(round: string | null): number {
  if (!round) return 0;
  const match = round.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Pack unordered pairings into rounds where no team appears twice in a round.
 * Remaining leftover pairings go into an optional catch-up round at the end.
 */
export function packPairingsIntoRounds(
  pairs: Array<{ team1Id: string; team2Id: string }>,
  startRound: number,
): { rounds: PlannedMatchInsert[]; catchUp: PlannedMatchInsert[] } {
  const remaining = [...pairs];
  const rounds: PlannedMatchInsert[] = [];
  let roundNum = startRound;

  while (remaining.length > 0) {
    const used = new Set<string>();
    const roundPairs: PlannedMatchInsert[] = [];
    const stillLeft: typeof remaining = [];

    for (const pair of remaining) {
      if (used.has(pair.team1Id) || used.has(pair.team2Id)) {
        stillLeft.push(pair);
        continue;
      }
      used.add(pair.team1Id);
      used.add(pair.team2Id);
      roundPairs.push({
        team1Id: pair.team1Id,
        team2Id: pair.team2Id,
        round: `Round ${roundNum}`,
      });
    }

    if (roundPairs.length === 0) {
      // Could not place any more without conflicts — shove rest into catch-up
      break;
    }

    rounds.push(...roundPairs);
    remaining.length = 0;
    remaining.push(...stillLeft);
    roundNum++;
  }

  const catchUp: PlannedMatchInsert[] = remaining.map((pair) => ({
    team1Id: pair.team1Id,
    team2Id: pair.team2Id,
    round: 'Catch-up',
  }));

  return { rounds, catchUp };
}

function buildPlayedPairSet(lockedMatches: RebuildMatchLike[]): Set<string> {
  const played = new Set<string>();
  for (const match of lockedMatches) {
    if (!match.team1_id || !match.team2_id) continue;
    played.add(pairKey(match.team1_id, match.team2_id));
  }
  return played;
}

function neededPairsMinusPlayed(
  teamIds: string[],
  played: Set<string>,
): Array<{ team1Id: string; team2Id: string }> {
  const needed: Array<{ team1Id: string; team2Id: string }> = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const a = teamIds[i];
      const b = teamIds[j];
      if (!played.has(pairKey(a, b))) {
        needed.push({ team1Id: a, team2Id: b });
      }
    }
  }
  return needed;
}

/**
 * Prefer circle-method ordering for remaining games, then fall back to any
 * missing pairs (catch-up for late adds).
 */
function orderedRemainingPairs(
  teamIds: string[],
  played: Set<string>,
): Array<{ team1Id: string; team2Id: string }> {
  const indexToId = teamIds;
  const pairings = generateTournamentRoundPairings(teamIds.length);
  const ordered: Array<{ team1Id: string; team2Id: string }> = [];
  const seen = new Set<string>();

  for (const pairing of pairings) {
    const a = indexToId[pairing.participant1Index];
    const b = indexToId[pairing.participant2Index];
    const key = pairKey(a, b);
    if (played.has(key) || seen.has(key)) continue;
    seen.add(key);
    ordered.push({ team1Id: a, team2Id: b });
  }

  // Safety: include any missing unique pairs not produced above
  for (const pair of neededPairsMinusPlayed(teamIds, played)) {
    const key = pairKey(pair.team1Id, pair.team2Id);
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(pair);
    }
  }

  return ordered;
}

export function planRegularSeasonRebuild(
  teams: RebuildTeamLike[],
  matches: RebuildMatchLike[],
  options?: { isTeamFilled?: (team: RebuildTeamLike) => boolean },
): ScheduleRebuildPlan {
  const isFilled =
    options?.isTeamFilled ??
    ((t: RebuildTeamLike) => !!(t.player1_name && t.player2_name) || !!t.player1_name);

  const filledTeams = teams.filter(isFilled);
  const teamIds = filledTeams.map((t) => t.id);

  const regular = matches.filter((m) => !m.is_playoff_match);
  const locked = regular.filter(matchHasLockedResults);
  const unlocked = regular.filter((m) => !matchHasLockedResults(m));

  const lockedRounds = new Set(
    locked.map((m) => parseRoundNumber(m.round)).filter((n) => n > 0),
  );
  const nextRoundStart = lockedRounds.size > 0 ? Math.max(...Array.from(lockedRounds)) + 1 : 1;

  const played = buildPlayedPairSet(locked);
  const remainingPairs = orderedRemainingPairs(teamIds, played);
  const { rounds, catchUp } = packPairingsIntoRounds(remainingPairs, nextRoundStart);

  // Attach group/pool labels when all filled teams share the same group/pool context
  // (plain RR has neither). For mixed groups, leave null — caller can refine.
  const matchesToInsert: PlannedMatchInsert[] = [...rounds, ...catchUp].map((m) => {
    const t1 = filledTeams.find((t) => t.id === m.team1Id);
    const t2 = filledTeams.find((t) => t.id === m.team2Id);
    const sameGroup =
      t1?.group_name && t2?.group_name && t1.group_name === t2.group_name
        ? t1.group_name
        : null;
    const samePool =
      t1?.pool_name && t2?.pool_name && t1.pool_name === t2.pool_name ? t1.pool_name : null;
    return {
      ...m,
      groupName: sameGroup,
      poolName: samePool,
    };
  });

  const lockedCount = locked.length;
  const deleteCount = unlocked.length;
  const insertCount = matchesToInsert.length;
  const catchUpCount = catchUp.length;

  const summaryParts = [
    `${lockedCount} completed/in-progress match${lockedCount === 1 ? '' : 'es'} kept`,
    `${deleteCount} unplayed match${deleteCount === 1 ? '' : 'es'} replaced`,
    `${insertCount} new match${insertCount === 1 ? '' : 'es'} scheduled`,
  ];
  if (catchUpCount > 0) {
    summaryParts.push(`${catchUpCount} catch-up match${catchUpCount === 1 ? '' : 'es'} at the end`);
  }

  return {
    lockedMatchIds: locked.map((m) => m.id),
    matchIdsToSoftDelete: unlocked.map((m) => m.id),
    matchesToInsert,
    lockedRoundCount: lockedRounds.size,
    nextRoundStart,
    catchUpRoundLabel: catchUpCount > 0 ? 'Catch-up' : null,
    summary: summaryParts.join(' · '),
  };
}

/**
 * Within each group or pool, rebuild remaining matches the same way.
 * Cross-group matches are not created.
 */
export function planGroupedRegularSeasonRebuild(
  teams: RebuildTeamLike[],
  matches: RebuildMatchLike[],
  mode: 'group' | 'pool',
  options?: { isTeamFilled?: (team: RebuildTeamLike) => boolean },
): ScheduleRebuildPlan {
  const isFilled =
    options?.isTeamFilled ??
    ((t: RebuildTeamLike) => !!(t.player1_name && t.player2_name) || !!t.player1_name);

  const filledTeams = teams.filter(isFilled);
  const keyOf = (t: RebuildTeamLike) =>
    mode === 'group' ? t.group_name || 'A' : t.pool_name || 'Pool 1';

  const buckets = new Map<string, RebuildTeamLike[]>();
  for (const team of filledTeams) {
    const key = keyOf(team);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(team);
  }

  const allLocked: string[] = [];
  const allDelete: string[] = [];
  const allInsert: PlannedMatchInsert[] = [];
  let maxNext = 1;
  let catchUpTotal = 0;

  // Unlocked matches that are regular-season and not attributed to a bucket still get deleted
  const regular = matches.filter((m) => !m.is_playoff_match);
  const unlockedGlobal = regular.filter((m) => !matchHasLockedResults(m));

  for (const [bucket, bucketTeams] of Array.from(buckets.entries())) {
    const bucketIds = new Set(bucketTeams.map((t) => t.id));
    const bucketMatches = regular.filter(
      (m) =>
        (m.team1_id && bucketIds.has(m.team1_id)) ||
        (m.team2_id && bucketIds.has(m.team2_id)) ||
        (mode === 'group' ? m.group_name === bucket : m.pool_name === bucket),
    );

    const plan = planRegularSeasonRebuild(bucketTeams, bucketMatches, { isTeamFilled: isFilled });
    allLocked.push(...plan.lockedMatchIds);
    allDelete.push(...plan.matchIdsToSoftDelete);
    allInsert.push(
      ...plan.matchesToInsert.map((m) => ({
        ...m,
        groupName: mode === 'group' ? bucket : m.groupName,
        poolName: mode === 'pool' ? bucket : m.poolName,
      })),
    );
    maxNext = Math.max(maxNext, plan.nextRoundStart);
    if (plan.catchUpRoundLabel) catchUpTotal += plan.matchesToInsert.filter((m) => m.round === 'Catch-up').length;
  }

  // Soft-delete any unlocked matches not covered
  const deleteSet = new Set(allDelete);
  for (const m of unlockedGlobal) {
    if (!deleteSet.has(m.id) && !allLocked.includes(m.id)) {
      deleteSet.add(m.id);
    }
  }

  return {
    lockedMatchIds: Array.from(new Set(allLocked)),
    matchIdsToSoftDelete: Array.from(deleteSet),
    matchesToInsert: allInsert,
    lockedRoundCount: 0,
    nextRoundStart: maxNext,
    catchUpRoundLabel: catchUpTotal > 0 ? 'Catch-up' : null,
    summary: `${allLocked.length} kept · ${deleteSet.size} replaced · ${allInsert.length} scheduled${
      catchUpTotal ? ` · ${catchUpTotal} catch-up` : ''
    }`,
  };
}

export interface PlayoffRebuildInputMatch extends RebuildMatchLike {
  playoff_round?: string | null;
  winner_team_id?: string | null;
  bracket_position?: number | null;
  seeding_position_team1?: number | null;
  seeding_position_team2?: number | null;
}

/**
 * Soft-delete incomplete playoff matches. Survivors = teams that haven't lost a
 * completed playoff match. Late entrants (filled teams never in a playoff match)
 * join the next field with an implicit bye for missed rounds.
 */
export function planPlayoffFieldAfterRosterChange(
  filledTeamIds: string[],
  playoffMatches: PlayoffRebuildInputMatch[],
): {
  matchIdsToSoftDelete: string[];
  survivorIds: string[];
  lateEntrantIds: string[];
  summary: string;
} {
  const locked = playoffMatches.filter(matchHasLockedResults);
  const unlocked = playoffMatches.filter((m) => !matchHasLockedResults(m));

  const lost = new Set<string>();
  for (const match of locked) {
    if (match.status !== 'completed' || !match.winner_team_id) continue;
    if (match.team1_id && match.team1_id !== match.winner_team_id) lost.add(match.team1_id);
    if (match.team2_id && match.team2_id !== match.winner_team_id) lost.add(match.team2_id);
  }

  const everInPlayoffs = new Set<string>();
  for (const match of playoffMatches) {
    if (match.team1_id) everInPlayoffs.add(match.team1_id);
    if (match.team2_id) everInPlayoffs.add(match.team2_id);
  }

  const survivorIds = filledTeamIds.filter((id) => everInPlayoffs.has(id) && !lost.has(id));
  const lateEntrantIds = filledTeamIds.filter((id) => !everInPlayoffs.has(id));

  return {
    matchIdsToSoftDelete: unlocked.map((m) => m.id),
    survivorIds,
    lateEntrantIds,
    summary: `${locked.length} completed playoff match${locked.length === 1 ? '' : 'es'} kept · ${
      unlocked.length
    } unplayed playoff match${unlocked.length === 1 ? '' : 'es'} cleared · ${
      survivorIds.length
    } survivor${survivorIds.length === 1 ? '' : 's'} · ${lateEntrantIds.length} late entrant${
      lateEntrantIds.length === 1 ? '' : 's'
    } (bye for missed rounds)`,
  };
}
