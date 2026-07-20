/**
 * Generate a round-robin schedule for league teams
 * Each team plays every other team once in random order
 */

interface ScheduleMatchup {
  homeTeamIndex: number;
  awayTeamIndex: number;
  weekNumber: number;
}

/**
 * Core pairing interface for round-robin algorithms
 */
export interface RoundRobinPairing {
  participant1Index: number;
  participant2Index: number;
  roundNumber: number;
}

/**
 * Generate round-robin pairings using the "circle method" algorithm.
 * This ensures each participant plays every other participant exactly once.
 *
 * Algorithm: Keep position 0 fixed, rotate all other positions clockwise each round.
 * For odd numbers, a -1 (bye) is added and filtered out.
 *
 * @param numParticipants - Number of participants (teams/players)
 * @returns Array of pairings where each pair plays exactly once
 */
export function generateRoundRobinPairings(numParticipants: number): RoundRobinPairing[] {
  if (numParticipants < 2) {
    return [];
  }

  const pairings: RoundRobinPairing[] = [];
  const participants = Array.from({ length: numParticipants }, (_, i) => i);

  // For odd number of participants, add a "bye" participant
  const isOdd = numParticipants % 2 === 1;
  const participantsWithBye = isOdd ? [...participants, -1] : participants;
  const totalParticipants = participantsWithBye.length;

  // Fix position 0, rotate positions 1..n-1 one step each round,
  // then pair symmetrically: arrangement[i] vs arrangement[n-1-i].
  // This guarantees no participant appears twice in the same round.
  let rotating = participantsWithBye.slice(1);

  for (let round = 0; round < totalParticipants - 1; round++) {
    const arrangement = [participantsWithBye[0], ...rotating];

    for (let i = 0; i < totalParticipants / 2; i++) {
      const p1 = arrangement[i];
      const p2 = arrangement[totalParticipants - 1 - i];

      if (p1 !== -1 && p2 !== -1) {
        pairings.push({
          participant1Index: p1,
          participant2Index: p2,
          roundNumber: round + 1,
        });
      }
    }

    // Rotate: move last element of rotating to the front
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return pairings;
}

/**
 * Generate a round-robin schedule where each team plays every other team once
 * @param numTeams - Number of teams in the league
 * @returns Array of matchups with home/away team indices and week numbers
 */
export function generateRoundRobinSchedule(numTeams: number): ScheduleMatchup[] {
  if (numTeams < 2) {
    throw new Error('Need at least 2 teams to generate a schedule');
  }

  // Use the core pairing algorithm
  const pairings = generateRoundRobinPairings(numTeams);

  // Convert to the legacy matchup format
  const matchups: ScheduleMatchup[] = pairings.map(pairing => ({
    homeTeamIndex: pairing.participant1Index,
    awayTeamIndex: pairing.participant2Index,
    weekNumber: pairing.roundNumber,
  }));

  // Randomize the order within each week for variety
  const weekGroups = new Map<number, ScheduleMatchup[]>();

  for (const matchup of matchups) {
    if (!weekGroups.has(matchup.weekNumber)) {
      weekGroups.set(matchup.weekNumber, []);
    }
    weekGroups.get(matchup.weekNumber)!.push(matchup);
  }

  // Shuffle matchups within each week
  const shuffledMatchups: ScheduleMatchup[] = [];
  for (const [weekNumber, weekMatchups] of Array.from(weekGroups.entries()).sort((a, b) => a[0] - b[0])) {
    const shuffled = shuffleArray([...weekMatchups]);
    shuffledMatchups.push(...shuffled);
  }

  return shuffledMatchups;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculate the number of weeks needed for a round-robin schedule
 * @param numTeams - Number of teams in the league
 * @returns Number of weeks needed
 */
export function calculateWeeksForRoundRobin(numTeams: number): number {
  if (numTeams < 2) return 0;
  return numTeams % 2 === 0 ? numTeams - 1 : numTeams;
}

/**
 * Generate tournament round pairings ensuring no team plays more than once per round.
 * Uses a correct circle-method implementation: fix position 0, rotate positions 1..n-1
 * one step each round, then pair symmetrically across the array.
 * This is used for the Tournament (group_stage_playoffs) format only.
 */
export function generateTournamentRoundPairings(numParticipants: number): RoundRobinPairing[] {
  if (numParticipants < 2) return [];

  const isOdd = numParticipants % 2 === 1;
  const n = isOdd ? numParticipants + 1 : numParticipants;
  const ids: number[] = Array.from({ length: numParticipants }, (_, i) => i);
  if (isOdd) ids.push(-1);

  const pairings: RoundRobinPairing[] = [];
  // rotating holds ids[1..n-1]; ids[0] is fixed
  let rotating = ids.slice(1);

  for (let round = 0; round < n - 1; round++) {
    const roundPairings: RoundRobinPairing[] = [];
    // Build the full arrangement for this round: [ids[0], ...rotating]
    const arrangement = [ids[0], ...rotating];

    // Pair symmetrically: arrangement[i] vs arrangement[n-1-i]
    for (let i = 0; i < n / 2; i++) {
      const p1 = arrangement[i];
      const p2 = arrangement[n - 1 - i];
      if (p1 !== -1 && p2 !== -1) {
        roundPairings.push({ participant1Index: p1, participant2Index: p2, roundNumber: round + 1 });
      }
    }

    if (roundPairings.length > 0) pairings.push(...roundPairings);

    // Rotate: move last element of rotating to the front
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return pairings;
}

/**
 * Generate matches for group stage tournaments
 * Returns pairings grouped by group name
 */
export interface GroupStagePairing extends RoundRobinPairing {
  groupName: string;
}

export function generateGroupStagePairings(
  teamsByGroup: Map<string, number[]>
): GroupStagePairing[] {
  const allPairings: GroupStagePairing[] = [];

  for (const [groupName, teamIndices] of Array.from(teamsByGroup.entries())) {
    // Use tournament-safe pairings so no team plays twice in the same round within a group
    const groupPairings = generateTournamentRoundPairings(teamIndices.length);

    // Map local indices back to global team indices and add group name
    for (const pairing of groupPairings) {
      allPairings.push({
        participant1Index: teamIndices[pairing.participant1Index],
        participant2Index: teamIndices[pairing.participant2Index],
        roundNumber: pairing.roundNumber,
        groupName,
      });
    }
  }

  return allPairings;
}

// ─── Pool Play ────────────────────────────────────────────────────────────────

export interface PoolPlayPairing extends RoundRobinPairing {
  poolName: string;
}

/**
 * Generate pool play matches.
 *
 * For each pool, use the circle-method to build a fair schedule, then keep
 * only the first `gamesPerPool` rounds so each team plays exactly that many
 * opponents. Teams within a pool never play a team outside their pool.
 *
 * @param teamsByPool  Map of poolName → array of global team indices
 * @param gamesPerPool How many opponents each team plays within the pool
 */
export function generatePoolPlayPairings(
  teamsByPool: Map<string, number[]>,
  gamesPerPool: number
): PoolPlayPairing[] {
  const allPairings: PoolPlayPairing[] = [];

  for (const [poolName, teamIndices] of Array.from(teamsByPool.entries())) {
    const fullPairings = generateTournamentRoundPairings(teamIndices.length);
    const limited = fullPairings.filter(p => p.roundNumber <= gamesPerPool);

    for (const pairing of limited) {
      allPairings.push({
        participant1Index: teamIndices[pairing.participant1Index],
        participant2Index: teamIndices[pairing.participant2Index],
        roundNumber: pairing.roundNumber,
        poolName,
      });
    }
  }

  return allPairings;
}
