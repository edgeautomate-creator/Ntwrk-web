export interface Player {
  user_id: string | null;
  player_name: string;
  dupr_id?: string;
  dupr_rating?: number;
  session_player_id?: string;
}

export interface SinglesMatchup {
  round_number: number;
  player_a: Player | null;
  player_b: Player | null;
  is_bye: boolean;
}

export interface DoublesMatchup {
  round_number: number;
  team1_player1: Player | null;
  team1_player2: Player | null;
  team2_player1: Player | null;
  team2_player2: Player | null;
  is_bye: boolean;
}

const getPlayerId = (player: Player): string => {
  return player.user_id || player.session_player_id || player.player_name;
};

const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function generateSinglesSchedule(players: Player[]): SinglesMatchup[] {
  const n = players.length;
  if (n < 2) return [];

  const matchups: SinglesMatchup[] = [];
  const isOdd = n % 2 !== 0;
  const participantsWithBye = isOdd
    ? [...players, { user_id: 'BYE', player_name: 'BYE', session_player_id: 'BYE' }]
    : players;
  const totalParticipants = participantsWithBye.length;

  // Fix position 0, rotate positions 1..n-1 one step each round,
  // then pair symmetrically: arrangement[i] vs arrangement[n-1-i].
  // This guarantees no player appears twice in the same round.
  let rotating = participantsWithBye.slice(1);

  for (let round = 0; round < totalParticipants - 1; round++) {
    const arrangement = [participantsWithBye[0], ...rotating];

    for (let i = 0; i < totalParticipants / 2; i++) {
      const playerA = arrangement[i];
      const playerB = arrangement[totalParticipants - 1 - i];
      const isBye = getPlayerId(playerA) === 'BYE' || getPlayerId(playerB) === 'BYE';

      if (!isBye) {
        matchups.push({
          round_number: round + 1,
          player_a: playerA,
          player_b: playerB,
          is_bye: false,
        });
      }
    }

    // Rotate: move last element of rotating to the front
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return matchups;
}

const MAX_OPPOSITION_COUNT = 3;

function generateDoublesScheduleAttempt(players: Player[]): DoublesMatchup[] {
  const n = players.length;
  const matchups: DoublesMatchup[] = [];

  const partnerships = new Map<string, number>();
  const individualOppositions = new Map<string, number>();

  const getKey = (p1: string, p2: string) => {
    return [p1, p2].sort().join('-');
  };

  const partnerCount = (p1: string, p2: string) => {
    return partnerships.get(getKey(p1, p2)) || 0;
  };

  const getIndividualOppositionCount = (p1: string, p2: string) => {
    return individualOppositions.get(getKey(p1, p2)) || 0;
  };

  const recordPartnership = (p1: string, p2: string) => {
    const key = getKey(p1, p2);
    partnerships.set(key, (partnerships.get(key) || 0) + 1);
  };

  const recordIndividualOpposition = (p1: string, p2: string) => {
    const key = getKey(p1, p2);
    individualOppositions.set(key, (individualOppositions.get(key) || 0) + 1);
  };

  const canCreateMatch = (p1: string, p2: string, p3: string, p4: string): boolean => {
    return (
      getIndividualOppositionCount(p1, p3) < MAX_OPPOSITION_COUNT &&
      getIndividualOppositionCount(p1, p4) < MAX_OPPOSITION_COUNT &&
      getIndividualOppositionCount(p2, p3) < MAX_OPPOSITION_COUNT &&
      getIndividualOppositionCount(p2, p4) < MAX_OPPOSITION_COUNT
    );
  };

  const calculateMatchScore = (p1: string, p2: string, p3: string, p4: string): number => {
    const partnerScore = partnerCount(p1, p2) * 100 + partnerCount(p3, p4) * 100;

    const opponentScore =
      getIndividualOppositionCount(p1, p3) * 50 +
      getIndividualOppositionCount(p1, p4) * 50 +
      getIndividualOppositionCount(p2, p3) * 50 +
      getIndividualOppositionCount(p2, p4) * 50;

    const randomFactor = Math.random() * 5;

    return partnerScore + opponentScore + randomFactor;
  };

  let roundNumber = 1;
  const maxRounds = n - 1;

  for (let round = 0; round < maxRounds; round++) {
    const availablePlayers = [...players];
    const roundMatchups: DoublesMatchup[] = [];

    while (availablePlayers.length >= 4) {
      let bestMatch: { team1: Player[], team2: Player[], score: number } | null = null;
      let bestScore = Infinity;

      for (let i = 0; i < availablePlayers.length; i++) {
        for (let j = i + 1; j < availablePlayers.length; j++) {
          for (let k = 0; k < availablePlayers.length; k++) {
            if (k === i || k === j) continue;
            for (let l = k + 1; l < availablePlayers.length; l++) {
              if (l === i || l === j) continue;

              const p1 = availablePlayers[i];
              const p2 = availablePlayers[j];
              const p3 = availablePlayers[k];
              const p4 = availablePlayers[l];

              const p1Id = getPlayerId(p1);
              const p2Id = getPlayerId(p2);
              const p3Id = getPlayerId(p3);
              const p4Id = getPlayerId(p4);

              if (!canCreateMatch(p1Id, p2Id, p3Id, p4Id)) {
                continue;
              }

              const score = calculateMatchScore(p1Id, p2Id, p3Id, p4Id);

              if (score < bestScore) {
                bestScore = score;
                bestMatch = {
                  team1: [p1, p2],
                  team2: [p3, p4],
                  score
                };
              }
            }
          }
        }
      }

      if (bestMatch) {
        roundMatchups.push({
          round_number: roundNumber,
          team1_player1: bestMatch.team1[0],
          team1_player2: bestMatch.team1[1],
          team2_player1: bestMatch.team2[0],
          team2_player2: bestMatch.team2[1],
          is_bye: false
        });

        const p1Id = getPlayerId(bestMatch.team1[0]);
        const p2Id = getPlayerId(bestMatch.team1[1]);
        const p3Id = getPlayerId(bestMatch.team2[0]);
        const p4Id = getPlayerId(bestMatch.team2[1]);

        recordPartnership(p1Id, p2Id);
        recordPartnership(p3Id, p4Id);
        recordIndividualOpposition(p1Id, p3Id);
        recordIndividualOpposition(p1Id, p4Id);
        recordIndividualOpposition(p2Id, p3Id);
        recordIndividualOpposition(p2Id, p4Id);

        availablePlayers.splice(
          availablePlayers.findIndex(p => getPlayerId(p) === p1Id), 1
        );
        availablePlayers.splice(
          availablePlayers.findIndex(p => getPlayerId(p) === p2Id), 1
        );
        availablePlayers.splice(
          availablePlayers.findIndex(p => getPlayerId(p) === p3Id), 1
        );
        availablePlayers.splice(
          availablePlayers.findIndex(p => getPlayerId(p) === p4Id), 1
        );
      } else {
        break;
      }
    }

    matchups.push(...roundMatchups);
    roundNumber++;
  }

  return matchups;
}

function calculateScheduleQuality(matchups: DoublesMatchup[]): number {
  const oppositionCounts = new Map<string, number>();

  const getKey = (p1: string, p2: string) => {
    return [p1, p2].sort().join('-');
  };

  for (const matchup of matchups) {
    const p1 = getPlayerId(matchup.team1_player1!);
    const p2 = getPlayerId(matchup.team1_player2!);
    const p3 = getPlayerId(matchup.team2_player1!);
    const p4 = getPlayerId(matchup.team2_player2!);

    [
      getKey(p1, p3), getKey(p1, p4),
      getKey(p2, p3), getKey(p2, p4)
    ].forEach(key => {
      oppositionCounts.set(key, (oppositionCounts.get(key) || 0) + 1);
    });
  }

  const counts = Array.from(oppositionCounts.values());
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;

  return variance;
}

export function generateDoublesSchedule(players: Player[]): DoublesMatchup[] {
  const n = players.length;
  if (n < 4) return [];

  if (n === 4) {
    return [
      {
        round_number: 1,
        team1_player1: players[0],
        team1_player2: players[1],
        team2_player1: players[2],
        team2_player2: players[3],
        is_bye: false
      },
      {
        round_number: 2,
        team1_player1: players[0],
        team1_player2: players[2],
        team2_player1: players[1],
        team2_player2: players[3],
        is_bye: false
      },
      {
        round_number: 3,
        team1_player1: players[0],
        team1_player2: players[3],
        team2_player1: players[1],
        team2_player2: players[2],
        is_bye: false
      }
    ];
  }

  let bestSchedule: DoublesMatchup[] = [];
  let bestQuality = Infinity;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffledPlayers = shuffleArray(players);
    const schedule = generateDoublesScheduleAttempt(shuffledPlayers);

    if (schedule.length > 0) {
      const quality = calculateScheduleQuality(schedule);

      if (quality < bestQuality) {
        bestQuality = quality;
        bestSchedule = schedule;
      }
    }
  }

  return bestSchedule.length > 0 ? bestSchedule : generateDoublesScheduleAttempt(players);
}
