import { generateSinglesSchedule, generateDoublesSchedule } from './pickup-scheduling';

interface Player {
  id: string;
  user_id: string | null;
  player_name: string;
  dupr_id: string | null;
  dupr_rating: number | null;
}

interface TeamAssignment {
  team_number: number;
  player1_user_id: string | null;
  player1_name: string;
  player1_dupr_id: string | null;
  player1_rating: number | null;
  player2_user_id?: string | null;
  player2_name?: string;
  player2_dupr_id?: string | null;
  player2_rating?: number | null;
}

export interface MatchSchedule {
  team1_team_number: number;
  team2_team_number: number;
  round: string;
}

/**
 * Generate Round Robin tournament teams and matches
 * For singles: creates one team per player
 * For doubles: randomly pairs players into teams
 */
export function generateKingOfTheHillSchedule(
  players: Player[],
  format: 'singles' | 'doubles'
): { teams: TeamAssignment[]; matches: MatchSchedule[] } {
  const teams: TeamAssignment[] = [];

  if (format === 'singles') {
    // Create one team per player
    players.forEach((player, index) => {
      teams.push({
        team_number: index + 1,
        player1_user_id: player.user_id,
        player1_name: player.player_name,
        player1_dupr_id: player.dupr_id,
        player1_rating: player.dupr_rating
      });
    });

    // Generate round-robin schedule using singles logic
    const scheduleData = generateSinglesSchedule(
      players.map((p, i) => ({
        user_id: p.user_id,
        player_name: p.player_name,
        dupr_id: p.dupr_id || undefined,
        dupr_rating: p.dupr_rating || undefined,
        session_player_id: p.id,
        team_number: i + 1
      }))
    );

    // Convert to match schedule format
    const matches: MatchSchedule[] = scheduleData.map(match => ({
      team1_team_number: (match.player_a as any).team_number,
      team2_team_number: (match.player_b as any).team_number,
      round: `Round ${match.round_number}`
    }));

    return { teams, matches };
  } else {
    // Doubles: randomly pair players
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const numTeams = Math.floor(shuffledPlayers.length / 2);

    for (let i = 0; i < numTeams; i++) {
      const player1 = shuffledPlayers[i * 2];
      const player2 = shuffledPlayers[i * 2 + 1];

      teams.push({
        team_number: i + 1,
        player1_user_id: player1.user_id,
        player1_name: player1.player_name,
        player1_dupr_id: player1.dupr_id,
        player1_rating: player1.dupr_rating,
        player2_user_id: player2.user_id,
        player2_name: player2.player_name,
        player2_dupr_id: player2.dupr_id,
        player2_rating: player2.dupr_rating
      });
    }

    // Generate round-robin schedule using doubles logic
    const teamPlayers = teams.flatMap((team, teamIndex) => [
      {
        user_id: team.player1_user_id || null,
        player_name: team.player1_name,
        dupr_id: team.player1_dupr_id || undefined,
        dupr_rating: team.player1_rating || undefined,
        session_player_id: `${teamIndex}-1`,
        team_number: team.team_number
      },
      {
        user_id: team.player2_user_id || null,
        player_name: team.player2_name!,
        dupr_id: team.player2_dupr_id || undefined,
        dupr_rating: team.player2_rating || undefined,
        session_player_id: `${teamIndex}-2`,
        team_number: team.team_number
      }
    ]);

    const scheduleData = generateDoublesSchedule(teamPlayers);

    // Convert to match schedule format, extracting unique team matchups
    const seenMatchups = new Set<string>();
    const matches: MatchSchedule[] = [];

    scheduleData.forEach(match => {
      const team1 = (match.team1_player1 as any).team_number;
      const team2 = (match.team2_player1 as any).team_number;
      const matchKey = [team1, team2].sort().join('-');

      if (!seenMatchups.has(matchKey)) {
        seenMatchups.add(matchKey);
        matches.push({
          team1_team_number: team1,
          team2_team_number: team2,
          round: `Round ${match.round_number}`
        });
      }
    });

    return { teams, matches };
  }
}
