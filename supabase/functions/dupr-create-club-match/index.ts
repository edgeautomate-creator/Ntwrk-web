import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DUPR_BASE = 'https://prod.mydupr.com/api';

async function getDuprToken(clientKey: string, clientSecret: string): Promise<string> {
  if (!clientKey || !clientSecret) {
    throw new Error('DUPR_CLIENT_KEY and DUPR_CLIENT_SECRET must be configured');
  }
  const authString = btoa(`${clientKey}:${clientSecret}`);
  const duprResponse = await fetch(`${DUPR_BASE}/auth/v1.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-authorization': authString,
    },
  });
  console.log('we are getting this error from the dupr', duprResponse)
  const contentType = duprResponse.headers.get('content-type');
  let duprResult: { result?: { token?: string }; message?: string };
  if (contentType?.includes('application/json')) {
    duprResult = await duprResponse.json();
  } else {
    const text = await duprResponse.text();
    throw new Error(`DUPR auth failed: ${text.substring(0, 100)}`);
  }
  if (!duprResponse.ok) {
    throw new Error(duprResult.message || `DUPR auth failed ${duprResponse.status}`);
  }
  if (!duprResult.result?.token) {
    throw new Error('Invalid DUPR response: missing token');
  }
  return duprResult.result.token;
}

function formatMatchDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildTeamPayload(
  team: { player1_dupr_id: string | null; player2_dupr_id: string | null },
  score: number,
  isDoubles: boolean
): { player1: string; player2?: string; game1: number; game2?: number; game3?: number; game4?: number; game5?: number } {
  const base: Record<string, unknown> = {
    player1: team.player1_dupr_id || '',
    game1: score,
  };
  if (isDoubles && team.player2_dupr_id) {
    base.player2 = team.player2_dupr_id;
  }
  return base as { player1: string; player2?: string; game1: number; game2?: number; game3?: number; game4?: number; game5?: number };
}

function validateGameScore(score: number): boolean {
  return score >= 0 && score <= 30 && Number.isInteger(score);
}

function buildCreateTeamPayload(
  team: { player1_dupr_id: string | null; player2_dupr_id: string | null },
  gameScores: number[],
  isDoubles: boolean
): { player1: string; player2?: string; game1?: number; game2?: number; game3?: number; game4?: number; game5?: number } {
  const base: Record<string, unknown> = {
    player1: team.player1_dupr_id || '',
  };

  if (isDoubles && team.player2_dupr_id) {
    base.player2 = team.player2_dupr_id;
  }

  gameScores.forEach((score, index) => {
    if (index < 5 && score !== null && score !== undefined) {
      if (!validateGameScore(score)) {
        throw new Error(`Invalid game score: ${score}. Scores must be between 0 and 30.`);
      }
      base[`game${index + 1}`] = score;
    }
  });

  return base as { player1: string; player2?: string; game1?: number; game2?: number; game3?: number; game4?: number; game5?: number };
}

function buildUpdateTeamPayload(
  team: { player1_dupr_id: string | null; player2_dupr_id: string | null },
  score: number,
  isDoubles: boolean
): { player1: string; player2?: string; game1: number; game2: number; game3: number; game4: number; game5: number } {
  const payload: { player1: string; player2?: string; game1: number; game2: number; game3: number; game4: number; game5: number } = {
    player1: team.player1_dupr_id || '',
    game1: score,
    game2: 0,
    game3: 0,
    game4: 0,
    game5: 0,
  };
  if (isDoubles && team.player2_dupr_id) {
    payload.player2 = team.player2_dupr_id;
  }
  return payload;
}

function buildUpdateTeamPayloadWithGames(
  team: { player1_dupr_id: string | null; player2_dupr_id: string | null },
  gameScores: number[],
  isDoubles: boolean
): { player1: string; player2?: string; game1?: number; game2?: number; game3?: number; game4?: number; game5?: number } {
  const payload: Record<string, unknown> = {
    player1: team.player1_dupr_id || '',
  };

  if (isDoubles && team.player2_dupr_id) {
    payload.player2 = team.player2_dupr_id;
  }

  gameScores.forEach((score, index) => {
    if (index < 5 && score !== null && score !== undefined) {
      if (!validateGameScore(score)) {
        throw new Error(`Invalid game score: ${score}. Scores must be between 0 and 30.`);
      }
      payload[`game${index + 1}`] = score;
    }
  });

  return payload as { player1: string; player2?: string; game1?: number; game2?: number; game3?: number; game4?: number; game5?: number };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
    const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: { matchId?: string; matchType?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const matchId = body.matchId;
    const matchType = body.matchType || 'tournament';

    if (!matchId || typeof matchId !== 'string') {
      return new Response(JSON.stringify({ error: 'matchId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle pickup matches
    if (matchType === 'pickup') {
      const { data: match, error: matchError } = await supabase
        .from('pickup_matchups')
        .select('id, session_id, format, match_datetime, dupr_match_id, dupr_match_identifier, game1_team1_points, game1_team2_points, game2_team1_points, game2_team2_points, game3_team1_points, game3_team2_points, game4_team1_points, game4_team2_points, game5_team1_points, game5_team2_points, player_a_id, player_b_id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        return new Response(JSON.stringify({ error: 'Pickup match not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session, error: sessionError } = await supabase
        .from('pickup_sessions')
        .select('id, name, dupr_club_id, session_date')
        .eq('id', match.session_id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Pickup session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clubIdRaw = session.dupr_club_id;
      if (!clubIdRaw?.trim()) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_club' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const clubId = Number(clubIdRaw);
      if (Number.isNaN(clubId)) {
        return new Response(JSON.stringify({ error: 'Invalid pickup session dupr_club_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isDoubles = match.format === 'doubles';

      // Collect player IDs based on format
      const playerIds: string[] = [];
      if (isDoubles) {
        if (match.team1_player1_id) playerIds.push(match.team1_player1_id);
        if (match.team1_player2_id) playerIds.push(match.team1_player2_id);
        if (match.team2_player1_id) playerIds.push(match.team2_player1_id);
        if (match.team2_player2_id) playerIds.push(match.team2_player2_id);
      } else {
        if (match.player_a_id) playerIds.push(match.player_a_id);
        if (match.player_b_id) playerIds.push(match.player_b_id);
      }

      if (playerIds.length === 0) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_players' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch pickup_session_players to get dupr_ids
      const { data: sessionPlayers, error: playersError } = await supabase
        .from('pickup_session_players')
        .select('id, dupr_id')
        .in('id', playerIds);

      if (playersError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch player data' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const playerMap = new Map((sessionPlayers || []).map(p => [p.id, p.dupr_id]));

      let team1Player1Dupr: string | null = null;
      let team1Player2Dupr: string | null = null;
      let team2Player1Dupr: string | null = null;
      let team2Player2Dupr: string | null = null;

      if (isDoubles) {
        team1Player1Dupr = match.team1_player1_id ? playerMap.get(match.team1_player1_id) || null : null;
        team1Player2Dupr = match.team1_player2_id ? playerMap.get(match.team1_player2_id) || null : null;
        team2Player1Dupr = match.team2_player1_id ? playerMap.get(match.team2_player1_id) || null : null;
        team2Player2Dupr = match.team2_player2_id ? playerMap.get(match.team2_player2_id) || null : null;

        if (!team1Player1Dupr || !team1Player2Dupr || !team2Player1Dupr || !team2Player2Dupr) {
          return new Response(
            JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        team1Player1Dupr = match.player_a_id ? playerMap.get(match.player_a_id) || null : null;
        team2Player1Dupr = match.player_b_id ? playerMap.get(match.player_b_id) || null : null;

        if (!team1Player1Dupr || !team2Player1Dupr) {
          return new Response(
            JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const matchDate = formatMatchDate(match.match_datetime || session.session_date);
      if (!matchDate) {
        return new Response(JSON.stringify({ error: 'Could not determine match date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract game point scores for each team
      const team1GameScores: number[] = [];
      const team2GameScores: number[] = [];

      if (match.game1_team1_points != null && match.game1_team2_points != null) {
        team1GameScores.push(match.game1_team1_points);
        team2GameScores.push(match.game1_team2_points);
      }
      if (match.game2_team1_points != null && match.game2_team2_points != null) {
        team1GameScores.push(match.game2_team1_points);
        team2GameScores.push(match.game2_team2_points);
      }
      if (match.game3_team1_points != null && match.game3_team2_points != null) {
        team1GameScores.push(match.game3_team1_points);
        team2GameScores.push(match.game3_team2_points);
      }
      if (match.game4_team1_points != null && match.game4_team2_points != null) {
        team1GameScores.push(match.game4_team1_points);
        team2GameScores.push(match.game4_team2_points);
      }
      if (match.game5_team1_points != null && match.game5_team2_points != null) {
        team1GameScores.push(match.game5_team1_points);
        team2GameScores.push(match.game5_team2_points);
      }

      if (team1GameScores.length === 0) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_games_played' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const format = isDoubles ? 'DOUBLES' : 'SINGLES';
      const team1 = { player1_dupr_id: team1Player1Dupr, player2_dupr_id: team1Player2Dupr };
      const team2 = { player1_dupr_id: team2Player1Dupr, player2_dupr_id: team2Player2Dupr };

      const teamA = buildCreateTeamPayload(team1, team1GameScores, isDoubles);
      const teamB = buildCreateTeamPayload(team2, team2GameScores, isDoubles);

      const duprToken = await getDuprToken(clientKey!, clientSecret!);

      let identifier = match.dupr_match_identifier;
      let duprMatchId: number | null = match.dupr_match_id ?? null;
      let shouldCreate = true;

      if (duprMatchId != null) {
        const getRes = await fetch(`${DUPR_BASE}/match/v1.0/${duprMatchId}`, {
          headers: { 'Authorization': `Bearer ${duprToken}` },
        });
        if (getRes.ok) {
          shouldCreate = false;
          identifier = match.dupr_match_identifier || `dinkheads-pickup-${match.session_id}-${match.id}`;
        }
      }

      if (shouldCreate) {
        identifier = identifier || `dinkheads-pickup-${match.session_id}-${match.id}`;
        const createBody = {
          location: '',
          matchDate,
          teamA,
          teamB,
          format,
          event: session.name || 'Pickup Session',
          bracket: '',
          matchType: 'SIDEOUT',
          identifier,
          clubId,
          matchSource: 'CLUB',
        };
        console.log({createBody})
        const createRes = await fetch(`${DUPR_BASE}/match/v1.0/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${duprToken}`,
          },
          body: JSON.stringify(createBody),
        });

        const createResult = await createRes.json().catch(
          () => ({})) as { result?: { id?: number; matchId?: number; matchCode?: number }; message?: string };
        if (!createRes.ok) {
          console.log(createResult)
          return new Response(
            JSON.stringify({ error: createResult.message || 'DUPR create failed', duprResponse: createResult }),
            { status: createRes.status >= 500 ? 502 : createRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const id = createResult.result?.matchCode ?? createResult.result?.matchId;
        if (id != null) {
          duprMatchId = Number(id);
          console.log(`Successfully created DUPR match ${duprMatchId}, updating database...`);

          const { data: updateData, error: updateError } = await supabase
            .from('pickup_matchups')
            .update({ dupr_match_id: duprMatchId, dupr_match_identifier: identifier })
            .eq('id', matchId)
            .select();

          if (updateError) {
            console.error('Failed to update pickup_matchups with DUPR match ID:', {
              error: updateError,
              matchId,
              duprMatchId,
              identifier
            });
            return new Response(
              JSON.stringify({
                error: 'DUPR match created but database update failed',
                duprMatchId,
                dbError: updateError.message
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log(`Successfully updated pickup_matchups ${matchId} with DUPR match ID ${duprMatchId}`);
        }

        return new Response(
          JSON.stringify({ synced: true, created: true, duprMatchId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const teamAUpdate = buildUpdateTeamPayloadWithGames(team1, team1GameScores, isDoubles);
      const teamBUpdate = buildUpdateTeamPayloadWithGames(team2, team2GameScores, isDoubles);
      const updateBody = {
        matchId: duprMatchId,
        location: '',
        matchDate,
        teamA: teamAUpdate,
        teamB: teamBUpdate,
        format,
        event: session.name || 'Pickup Session',
        bracket: '',
        matchType: 'SIDEOUT',
        identifier: identifier || '',
        clubId,
        matchSource: 'CLUB',
        matchCompletionType: 'COMPLETED',
        matchPlayType: 'RECREATIONAL',
      };

      const updateRes = await fetch(`${DUPR_BASE}/match/v1.0/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${duprToken}`,
        },
        body: JSON.stringify(updateBody),
      });

      const updateResult = await updateRes.json().catch(() => ({})) as { message?: string };
      if (!updateRes.ok) {
        return new Response(
          JSON.stringify({ error: updateResult.message || 'DUPR update failed', duprResponse: updateResult }),
          { status: updateRes.status >= 500 ? 502 : updateRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ synced: true, created: false, duprMatchId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle league matches
    if (matchType === 'league') {
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('id, team1_id, team2_id, season_id, team1_score, team2_score, match_date, matchup_id, dupr_match_id, dupr_match_identifier, status')
        .eq('id', matchId)
        .single();
      
      if (matchError || !match) {
        return new Response(JSON.stringify({ error: 'League match not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (match.status !== 'completed') {
        return new Response(
          JSON.stringify({ synced: false, reason: 'incomplete_match' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: season, error: seasonError } = await supabase
        .from('seasons')
        .select('id, name, dupr_club_id, dupr_club_name, players_per_team, league_type')
        .eq('id', match.season_id)
        .single();

      if (seasonError || !season) {
        return new Response(JSON.stringify({ error: 'Season not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clubIdRaw = season.dupr_club_id;
      if (!clubIdRaw?.trim()) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_club' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const clubId = Number(clubIdRaw);
      if (Number.isNaN(clubId)) {
        return new Response(JSON.stringify({ error: 'Invalid season dupr_club_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: lineups, error: lineupsError } = await supabase
        .from('match_lineups')
        .select('id, team_id, player1_id, player2_id')
        .eq('match_id', matchId);

      if (lineupsError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch lineups' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const team1Lineup = lineups?.find(l => l.team_id === match.team1_id);
      const team2Lineup = lineups?.find(l => l.team_id === match.team2_id);

      let team1Player1Id: string | null = null;
      let team1Player2Id: string | null = null;
      let team2Player1Id: string | null = null;
      let team2Player2Id: string | null = null;

      if (team1Lineup && team2Lineup) {
        team1Player1Id = team1Lineup.player1_id;
        team1Player2Id = team1Lineup.player2_id;
        team2Player1Id = team2Lineup.player1_id;
        team2Player2Id = team2Lineup.player2_id;
      } else {
        const { data: team1Data, error: team1Error } = await supabase
          .from('teams')
          .select('player1_id, player2_id, player3_id, player4_id')
          .eq('id', match.team1_id)
          .single();

        const { data: team2Data, error: team2Error } = await supabase
          .from('teams')
          .select('player1_id, player2_id, player3_id, player4_id')
          .eq('id', match.team2_id)
          .single();

        if (team1Error || !team1Data || team2Error || !team2Data) {
          return new Response(JSON.stringify({ error: 'Team data not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        team1Player1Id = team1Data.player1_id;
        team1Player2Id = team1Data.player2_id;
        team2Player1Id = team2Data.player1_id;
        team2Player2Id = team2Data.player2_id;
      }

      if (!team1Player1Id || !team2Player1Id) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_lineup' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isDoubles = season.players_per_team === 2 || (team1Player2Id != null && team2Player2Id != null);

      if (isDoubles && (!team1Player2Id || !team2Player2Id)) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_lineup' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const playerIds: string[] = [team1Player1Id, team2Player1Id];
      if (isDoubles && team1Player2Id && team2Player2Id) {
        playerIds.push(team1Player2Id, team2Player2Id);
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, dupr_id')
        .in('id', playerIds);

      if (profilesError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch player profiles' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const profileMap = new Map((profiles || []).map(p => [p.id, p.dupr_id]));

      const team1Player1Dupr = profileMap.get(team1Player1Id) || null;
      const team1Player2Dupr = team1Player2Id ? profileMap.get(team1Player2Id) || null : null;
      const team2Player1Dupr = profileMap.get(team2Player1Id) || null;
      const team2Player2Dupr = team2Player2Id ? profileMap.get(team2Player2Id) || null : null;

      if (!team1Player1Dupr || !team2Player1Dupr) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (isDoubles && (!team1Player2Dupr || !team2Player2Dupr)) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const matchDate = formatMatchDate(match.match_date);
      if (!matchDate) {
        return new Response(JSON.stringify({ error: 'Could not determine match date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch individual game scores from games table
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('game_number, team1_score, team2_score')
        .eq('match_id', matchId)
        .order('game_number', { ascending: true });

      if (gamesError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch game data' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const team1GameScores: number[] = [];
      const team2GameScores: number[] = [];

      if (games && games.length > 0) {
        games.forEach(game => {
          if (game.team1_score != null && game.team2_score != null) {
            team1GameScores.push(game.team1_score);
            team2GameScores.push(game.team2_score);
          }
        });
      }

      if (team1GameScores.length === 0) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_games_played' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const format = isDoubles ? 'DOUBLES' : 'SINGLES';
      const team1 = { player1_dupr_id: team1Player1Dupr, player2_dupr_id: team1Player2Dupr };
      const team2 = { player1_dupr_id: team2Player1Dupr, player2_dupr_id: team2Player2Dupr };

      const teamA = buildCreateTeamPayload(team1, team1GameScores, isDoubles);
      const teamB = buildCreateTeamPayload(team2, team2GameScores, isDoubles);

      const duprToken = await getDuprToken(clientKey!, clientSecret!);

      let identifier = match.dupr_match_identifier;
      let duprMatchId: number | null = match.dupr_match_id ?? null;
      let shouldCreate = true;

      if (duprMatchId != null) {
        const getRes = await fetch(`${DUPR_BASE}/match/v1.0/${duprMatchId}`, {
          headers: { 'Authorization': `Bearer ${duprToken}` },
        });
        if (getRes.ok) {
          shouldCreate = false;
          identifier = match.dupr_match_identifier || `dinkheads-league-${match.season_id}-${match.id}`;
        }
      }

      if (shouldCreate) {
        identifier = identifier || `dinkheads-league-${match.season_id}-${match.id}`;
        const createBody = {
          location: '',
          matchDate,
          teamA,
          teamB,
          format,
          event: season.name || 'League Match',
          bracket: '',
          matchType: 'SIDEOUT',
          identifier,
          clubId,
          matchSource: 'CLUB',
        };

        const createRes = await fetch(`${DUPR_BASE}/match/v1.0/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${duprToken}`,
          },
          body: JSON.stringify(createBody),
        });

        const createResult = await createRes.json().catch(
          () => ({})) as { result?: { id?: number; matchId?: number; matchCode?: number }; message?: string };
        if (!createRes.ok) {
          return new Response(
            JSON.stringify({ error: createResult.message || 'DUPR create failed', duprResponse: createResult }),
            { status: createRes.status >= 500 ? 502 : createRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const id = createResult.result?.matchCode ?? createResult.result?.matchId;
        if (id != null) {
          duprMatchId = Number(id);
          await supabase
            .from('matches')
            .update({ dupr_match_id: duprMatchId, dupr_match_identifier: identifier })
            .eq('id', matchId);
        }

        return new Response(
          JSON.stringify({ synced: true, created: true, duprMatchId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const teamAUpdate = buildUpdateTeamPayloadWithGames(team1, team1GameScores, isDoubles);
      const teamBUpdate = buildUpdateTeamPayloadWithGames(team2, team2GameScores, isDoubles);
      const updateBody = {
        matchId: duprMatchId,
        location: '',
        matchDate,
        teamA: teamAUpdate,
        teamB: teamBUpdate,
        format,
        event: season.name || 'League Match',
        bracket: '',
        matchType: 'SIDEOUT',
        identifier: identifier || '',
        clubId,
        matchSource: 'CLUB',
        matchCompletionType: 'COMPLETED',
        matchPlayType: 'LEAGUE',
      };

      const updateRes = await fetch(`${DUPR_BASE}/match/v1.0/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${duprToken}`,
        },
        body: JSON.stringify(updateBody),
      });

      const updateResult = await updateRes.json().catch(() => ({})) as { message?: string };
      if (!updateRes.ok) {
        return new Response(
          JSON.stringify({ error: updateResult.message || 'DUPR update failed', duprResponse: updateResult }),
          { status: updateRes.status >= 500 ? 502 : updateRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ synced: true, created: false, duprMatchId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle tournament matches
    const { data: match, error: matchError } = await supabase
      .from('tournament_matches')
      .select('id, tournament_id, team1_id, team2_id, player1_id, player2_id, player3_id, player4_id, team1_score, team2_score, scheduled_time, completed_at, dupr_match_id, dupr_match_identifier, game1_team1_points, game1_team2_points, game2_team1_points, game2_team2_points, game3_team1_points, game3_team2_points, game4_team1_points, game4_team2_points, game5_team1_points, game5_team2_points')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return new Response(JSON.stringify({ error: 'Match not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, location, date, dupr_club_id, team_format, format')
      .eq('id', match.tournament_id)
      .single();

    if (tournamentError || !tournament) {
      return new Response(JSON.stringify({ error: 'Tournament not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clubIdRaw = tournament.dupr_club_id;
    if (!clubIdRaw?.trim()) {
      return new Response(
        JSON.stringify({ synced: false, reason: 'no_club' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clubId = Number(clubIdRaw);
    if (Number.isNaN(clubId)) {
      return new Response(JSON.stringify({ error: 'Invalid tournament dupr_club_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this is a Round Robin Individual match
    // Note: Round Robin Individual can use team_id (for single-player teams) or player_id columns
    const isRoundRobinIndividual = tournament.format === 'round_robin_individual';

    let team1Player1Dupr: string | null = null;
    let team1Player2Dupr: string | null = null;
    let team2Player1Dupr: string | null = null;
    let team2Player2Dupr: string | null = null;

    if (isRoundRobinIndividual) {
      // In round robin individual, player1_id/player2_id/player3_id/player4_id store
      // tournament_teams.id values (not profiles.id). Fetch DUPR IDs from tournament_teams.
      const teamIdsFromPlayerCols: string[] = [];
      if ((match as any).player1_id) teamIdsFromPlayerCols.push((match as any).player1_id);
      if ((match as any).player2_id) teamIdsFromPlayerCols.push((match as any).player2_id);
      if ((match as any).player3_id) teamIdsFromPlayerCols.push((match as any).player3_id);
      if ((match as any).player4_id) teamIdsFromPlayerCols.push((match as any).player4_id);

      if (teamIdsFromPlayerCols.length > 0) {
        // player_id columns hold tournament_teams.id — look up DUPR IDs from there
        const { data: teams, error: teamsError } = await supabase
          .from('tournament_teams')
          .select('id, player1_dupr_id, player2_dupr_id')
          .in('id', teamIdsFromPlayerCols);

        if (teamsError) {
          return new Response(JSON.stringify({ error: 'Failed to fetch team data' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const teamMap = new Map((teams || []).map(t => [t.id, t]));

        // Singles: player1_id = side A team, player3_id = side B team
        // Doubles: player1_id/player2_id = side A two players, player3_id/player4_id = side B two players
        const t1p1 = (match as any).player1_id ? teamMap.get((match as any).player1_id) : null;
        const t1p2 = (match as any).player2_id ? teamMap.get((match as any).player2_id) : null;
        const t2p1 = (match as any).player3_id ? teamMap.get((match as any).player3_id) : null;
        const t2p2 = (match as any).player4_id ? teamMap.get((match as any).player4_id) : null;

        team1Player1Dupr = t1p1?.player1_dupr_id || null;
        team1Player2Dupr = t1p2?.player1_dupr_id || null;
        team2Player1Dupr = t2p1?.player1_dupr_id || null;
        team2Player2Dupr = t2p2?.player1_dupr_id || null;
      } else if (match.team1_id && match.team2_id) {
        // Fallback: only team_id columns are set — fetch from tournament_teams directly
        const { data: team1, error: team1Error } = await supabase
          .from('tournament_teams')
          .select('player1_dupr_id, player2_dupr_id')
          .eq('id', match.team1_id)
          .single();

        const { data: team2, error: team2Error } = await supabase
          .from('tournament_teams')
          .select('player1_dupr_id, player2_dupr_id')
          .eq('id', match.team2_id)
          .single();

        if (team1Error || !team1 || team2Error || !team2) {
          return new Response(JSON.stringify({ error: 'Team data not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        team1Player1Dupr = team1.player1_dupr_id;
        team1Player2Dupr = team1.player2_dupr_id;
        team2Player1Dupr = team2.player1_dupr_id;
        team2Player2Dupr = team2.player2_dupr_id;
      } else {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_players' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isDoubles = tournament.team_format !== 'singles';
      if (!team1Player1Dupr || !team2Player1Dupr) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (isDoubles && (!team1Player2Dupr || !team2Player2Dupr)) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Traditional team-based tournament
      const { data: team1, error: team1Error } = await supabase
        .from('tournament_teams')
        .select('player1_dupr_id, player2_dupr_id')
        .eq('id', match.team1_id)
        .single();

      const { data: team2, error: team2Error } = await supabase
        .from('tournament_teams')
        .select('player1_dupr_id, player2_dupr_id')
        .eq('id', match.team2_id)
        .single();

      if (team1Error || !team1 || team2Error || !team2) {
        return new Response(JSON.stringify({ error: 'Team data not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      team1Player1Dupr = team1.player1_dupr_id;
      team1Player2Dupr = team1.player2_dupr_id;
      team2Player1Dupr = team2.player1_dupr_id;
      team2Player2Dupr = team2.player2_dupr_id;

      const isDoubles = tournament.team_format !== 'singles';
      if (!team1Player1Dupr?.trim() || !team2Player1Dupr?.trim()) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (isDoubles && (!team1Player2Dupr?.trim() || !team2Player2Dupr?.trim())) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'missing_player_dupr_ids' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const matchDate = formatMatchDate(match.completed_at || match.scheduled_time || tournament.date);
    if (!matchDate) {
      return new Response(JSON.stringify({ error: 'Could not determine match date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isDoubles = tournament.team_format !== 'singles';

    // For Round Robin Individual, extract game point scores
    let team1GameScores: number[] = [];
    let team2GameScores: number[] = [];

    if (isRoundRobinIndividual) {
      if ((match as any).game1_team1_points != null && (match as any).game1_team2_points != null) {
        team1GameScores.push((match as any).game1_team1_points);
        team2GameScores.push((match as any).game1_team2_points);
      }
      if ((match as any).game2_team1_points != null && (match as any).game2_team2_points != null) {
        team1GameScores.push((match as any).game2_team1_points);
        team2GameScores.push((match as any).game2_team2_points);
      }
      if ((match as any).game3_team1_points != null && (match as any).game3_team2_points != null) {
        team1GameScores.push((match as any).game3_team1_points);
        team2GameScores.push((match as any).game3_team2_points);
      }
      if ((match as any).game4_team1_points != null && (match as any).game4_team2_points != null) {
        team1GameScores.push((match as any).game4_team1_points);
        team2GameScores.push((match as any).game4_team2_points);
      }
      if ((match as any).game5_team1_points != null && (match as any).game5_team2_points != null) {
        team1GameScores.push((match as any).game5_team1_points);
        team2GameScores.push((match as any).game5_team2_points);
      }

      if (team1GameScores.length === 0) {
        return new Response(
          JSON.stringify({ synced: false, reason: 'no_games_played' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Traditional tournament matches: try game-by-game scores first, fall back to total score
      if (match.game1_team1_points != null && match.game1_team2_points != null) {
        team1GameScores.push(match.game1_team1_points);
        team2GameScores.push(match.game1_team2_points);
      }
      if (match.game2_team1_points != null && match.game2_team2_points != null) {
        team1GameScores.push(match.game2_team1_points);
        team2GameScores.push(match.game2_team2_points);
      }
      if (match.game3_team1_points != null && match.game3_team2_points != null) {
        team1GameScores.push(match.game3_team1_points);
        team2GameScores.push(match.game3_team2_points);
      }
      if (match.game4_team1_points != null && match.game4_team2_points != null) {
        team1GameScores.push(match.game4_team1_points);
        team2GameScores.push(match.game4_team2_points);
      }
      if (match.game5_team1_points != null && match.game5_team2_points != null) {
        team1GameScores.push(match.game5_team1_points);
        team2GameScores.push(match.game5_team2_points);
      }

      // If no game-by-game scores, fall back to total games won
      if (team1GameScores.length === 0) {
        const score1 = match.team1_score || 0;
        const score2 = match.team2_score || 0;
        if (score1 === 0 && score2 === 0) {
          return new Response(
            JSON.stringify({ synced: false, reason: 'no_score' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const format = isDoubles ? 'DOUBLES' : 'SINGLES';
    const team1 = { player1_dupr_id: team1Player1Dupr, player2_dupr_id: team1Player2Dupr };
    const team2 = { player1_dupr_id: team2Player1Dupr, player2_dupr_id: team2Player2Dupr };

    let teamA: any;
    let teamB: any;

    if (team1GameScores.length > 0) {
      teamA = buildCreateTeamPayload(team1, team1GameScores, isDoubles);
      teamB = buildCreateTeamPayload(team2, team2GameScores, isDoubles);
    } else {
      const score1 = match.team1_score || 0;
      const score2 = match.team2_score || 0;
      teamA = buildTeamPayload(team1, score1, isDoubles);
      teamB = buildTeamPayload(team2, score2, isDoubles);
    }

    const duprToken = await getDuprToken(clientKey!, clientSecret!);

    let identifier = match.dupr_match_identifier;
    let duprMatchId: number | null = match.dupr_match_id ?? null;
    let shouldCreate = true;

    if (duprMatchId != null) {
      const getRes = await fetch(`${DUPR_BASE}/match/v1.0/${duprMatchId}`, {
        headers: { 'Authorization': `Bearer ${duprToken}` },
      });
      if (getRes.ok) {
        shouldCreate = false;
        identifier = match.dupr_match_identifier || `dinkheads-${match.tournament_id}-${match.id}`;
      }
    }

    if (shouldCreate) {
      identifier = identifier || `dinkheads-${match.tournament_id}-${match.id}`;
      const createBody = {
        location: tournament.location || '',
        matchDate,
        teamA,
        teamB,
        format,
        event: tournament.name || '',
        bracket: '',
        matchType: 'SIDEOUT',
        identifier,
        clubId,
        matchSource: 'CLUB',
      };
      console.log(createBody)
      const createRes = await fetch(`${DUPR_BASE}/match/v1.0/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${duprToken}`,
        },
        body: JSON.stringify(createBody),
      });
      console.log(createRes);
      const createResult = await createRes.json().catch(
        () => ({})) as { result?: { id?: number; matchId?: number; matchCode?: number }; message?: string };
      if (!createRes.ok) {
        return new Response(
          JSON.stringify({ error: createResult.message || 'DUPR create failed', duprResponse: createResult }),
          { status: createRes.status >= 500 ? 502 : createRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const id = createResult.result?.matchCode ?? createResult.result?.matchId;
      if (id != null) {
        duprMatchId = Number(id);
        await supabase
          .from('tournament_matches')
          .update({ dupr_match_id: duprMatchId, dupr_match_identifier: identifier })
          .eq('id', matchId);
      }

      return new Response(
        JSON.stringify({ synced: true, created: true, duprMatchId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let teamAUpdate: any;
    let teamBUpdate: any;

    if (team1GameScores.length > 0) {
      teamAUpdate = buildUpdateTeamPayloadWithGames(team1, team1GameScores, isDoubles);
      teamBUpdate = buildUpdateTeamPayloadWithGames(team2, team2GameScores, isDoubles);
    } else {
      const score1 = match.team1_score || 0;
      const score2 = match.team2_score || 0;
      teamAUpdate = buildUpdateTeamPayload(team1, score1, isDoubles);
      teamBUpdate = buildUpdateTeamPayload(team2, score2, isDoubles);
    }
    const updateBody = {
      matchId: duprMatchId,
      location: tournament.location || '',
      matchDate,
      teamA: teamAUpdate,
      teamB: teamBUpdate,
      format,
      event: tournament.name || '',
      bracket: '',
      matchType: 'SIDEOUT',
      identifier: identifier || '',
      clubId,
      matchSource: 'CLUB',
      matchCompletionType: 'COMPLETED',
      matchPlayType: 'TOURNAMENT',
    };

    const updateRes = await fetch(`${DUPR_BASE}/match/v1.0/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${duprToken}`,
      },
      body: JSON.stringify(updateBody),
    });

    const updateResult = await updateRes.json().catch(() => ({})) as { message?: string };
    if (!updateRes.ok) {
      return new Response(
        JSON.stringify({ error: updateResult.message || 'DUPR update failed', duprResponse: updateResult }),
        { status: updateRes.status >= 500 ? 502 : updateRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ synced: true, created: false, duprMatchId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('dupr-create-club-match error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
