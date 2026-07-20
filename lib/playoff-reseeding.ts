export const PLAYOFF_ROUND_ORDER = [
  'Round of 32',
  'Round of 16',
  'First Round',
  'Quarterfinals',
  'Semifinals',
  'Finals',
] as const;

const NEXT_ROUND_MAP: Record<string, string> = {
  'Round of 32': 'Round of 16',
  'Round of 16': 'Quarterfinals',
  'First Round': 'Semifinals',
  Quarterfinals: 'Semifinals',
  Semifinals: 'Finals',
};

export interface PlayoffMatchLike {
  status: string;
  playoff_round?: string | null;
  winner_team_id?: string | null;
  team1_id?: string | null;
  team2_id?: string | null;
}

export interface ReseedMatchPayload {
  tournament_id: string;
  match_number: number;
  round: string;
  team1_id: string;
  team2_id: string | null;
  seeding_position_team1: number;
  seeding_position_team2: number | null;
  status: 'scheduled';
  is_playoff_match: true;
  playoff_round: string;
  bracket_position: number;
}

export function getNextPlayoffRound(currentRound: string): string | null {
  return NEXT_ROUND_MAP[currentRound] ?? null;
}

export function isPlayoffRoundComplete(matches: PlayoffMatchLike[]): boolean {
  if (matches.length === 0) return false;
  return matches.every(
    (match) =>
      match.status === 'completed' &&
      !!match.winner_team_id &&
      match.team2_id !== null
  );
}

export function getRoundSurvivorIds(matches: PlayoffMatchLike[]): string[] {
  const survivors: string[] = [];
  for (const match of matches) {
    if (match.status === 'completed' && match.winner_team_id) {
      survivors.push(match.winner_team_id);
    }
  }
  return survivors;
}

export function getReseedSurvivorIds(
  allMatches: PlayoffMatchLike[],
  completedRound: string
): string[] {
  const roundMatches = allMatches.filter((match) => match.playoff_round === completedRound);
  const survivors = getRoundSurvivorIds(roundMatches);
  const nextRound = getNextPlayoffRound(completedRound);
  const futureRound = nextRound ? getNextPlayoffRound(nextRound) : null;

  if (futureRound) {
    for (const match of allMatches) {
      if (
        match.playoff_round === futureRound &&
        match.team1_id &&
        match.team2_id === null
      ) {
        if (!survivors.includes(match.team1_id)) {
          survivors.push(match.team1_id);
        }
      }
    }
  }

  return survivors;
}

export function sortSurvivorsByOriginalSeed(
  survivorIds: string[],
  teams: { id: string; playoff_seed?: number | null }[]
): string[] {
  const seedByTeamId = new Map(teams.map((team) => [team.id, team.playoff_seed ?? 9999]));
  return [...survivorIds].sort(
    (a, b) => (seedByTeamId.get(a) ?? 9999) - (seedByTeamId.get(b) ?? 9999)
  );
}

export function findPendingReseedRound(
  matches: PlayoffMatchLike[],
  reseedingEnabled: boolean
): string | null {
  if (!reseedingEnabled) return null;

  for (const round of PLAYOFF_ROUND_ORDER) {
    const roundMatches = matches.filter((match) => match.playoff_round === round);
    if (roundMatches.length === 0) continue;
    if (!isPlayoffRoundComplete(roundMatches)) continue;

    const nextRound = getNextPlayoffRound(round);
    if (!nextRound) continue;
    if (matches.some((match) => match.playoff_round === nextRound)) continue;

    const survivors = getReseedSurvivorIds(matches, round);
    if (survivors.length >= 2) return round;
  }

  return null;
}

export function buildReseededRoundMatches(
  tournamentId: string,
  orderedTeamIds: string[],
  nextRoundName: string,
  startingMatchNumber: number
): ReseedMatchPayload[] {
  const count = orderedTeamIds.length;
  if (count < 2) return [];

  const matches: ReseedMatchPayload[] = [];
  let matchNumber = startingMatchNumber;
  let bracketPosition = 1;

  if (count % 2 === 1) {
    const byeTeamId = orderedTeamIds[0];
    const playingTeams = orderedTeamIds.slice(1);
    const halfLen = Math.floor(playingTeams.length / 2);

    for (let i = 0; i < halfLen; i++) {
      matches.push({
        tournament_id: tournamentId,
        match_number: matchNumber++,
        round: nextRoundName,
        team1_id: playingTeams[i],
        team2_id: playingTeams[playingTeams.length - 1 - i],
        seeding_position_team1: i + 2,
        seeding_position_team2: playingTeams.length + 1 - i,
        status: 'scheduled',
        is_playoff_match: true,
        playoff_round: nextRoundName,
        bracket_position: bracketPosition++,
      });
    }

    const byeRoundName = getNextPlayoffRound(nextRoundName);
    if (byeRoundName && byeTeamId) {
      matches.push({
        tournament_id: tournamentId,
        match_number: matchNumber++,
        round: byeRoundName,
        team1_id: byeTeamId,
        team2_id: null,
        seeding_position_team1: 1,
        seeding_position_team2: null,
        status: 'scheduled',
        is_playoff_match: true,
        playoff_round: byeRoundName,
        bracket_position: 1,
      });
    }

    return matches;
  }

  const halfLen = count / 2;
  for (let i = 0; i < halfLen; i++) {
    matches.push({
      tournament_id: tournamentId,
      match_number: matchNumber++,
      round: nextRoundName,
      team1_id: orderedTeamIds[i],
      team2_id: orderedTeamIds[count - 1 - i],
      seeding_position_team1: i + 1,
      seeding_position_team2: count - i,
      status: 'scheduled',
      is_playoff_match: true,
      playoff_round: nextRoundName,
      bracket_position: bracketPosition++,
    });
  }

  return matches;
}
