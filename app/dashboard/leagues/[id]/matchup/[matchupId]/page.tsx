'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trophy, Users, CircleAlert as AlertCircle, Plus, Save, Check, CreditCard as Edit2, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Team {
  id: string;
  name: string;
}

interface TeamMatchup {
  id: string;
  league_week_id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_time: string | null;
  status: string;
  home_matchup_wins: number;
  away_matchup_wins: number;
  finalized: boolean;
  home_team?: Team;
  away_team?: Team;
}

interface Match {
  id: string;
  matchup_id: string;
  match_number_in_matchup: number;
  team1_id: string;
  team2_id: string;
  team_id?: string;
  season_id?: string;
  organization_id?: string;
  match_date?: string;
  status: string;
  winner_team_id: string | null;
  is_tiebreaker: boolean;
  team1_score?: number;
  team2_score?: number;
}

interface Season {
  id: string;
  league_id: string;
  matches_per_matchup: number;
  game_to: number;
  win_by_2: boolean;
  enable_tiebreaker: boolean;
  tiebreaker_name: string;
}

interface Player {
  id: string;
  user_id: string;
  is_substitute: boolean;
  profiles?: {
    full_name: string | null;
    dupr_singles: number | null;
    dupr_doubles: number | null;
  };
}

interface Lineup {
  id: string;
  match_id: string;
  team_id: string;
  player1_id: string;
  player2_id: string;
  status: string;
}

export default function MatchupDetailPage({
  params
}: {
  params: { id: string; matchupId: string }
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [matchup, setMatchup] = useState<TeamMatchup | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [homeTeamPlayers, setHomeTeamPlayers] = useState<Player[]>([]);
  const [awayTeamPlayers, setAwayTeamPlayers] = useState<Player[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [isCaptain, setIsCaptain] = useState({ home: false, away: false });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadMatchupData();
  }, [params.matchupId]);

  const loadMatchupData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setCurrentUserId(session.user.id);

      const { data: matchupData, error: matchupError } = await supabase
        .from('team_matchups')
        .select(`
          *,
          home_team:teams!team_matchups_home_team_id_fkey(*),
          away_team:teams!team_matchups_away_team_id_fkey(*)
        `)
        .eq('id', params.matchupId)
        .single();

      if (matchupError) throw matchupError;
      setMatchup(matchupData as any);

      const { data: weekData } = await supabase
        .from('league_weeks')
        .select('season_id')
        .eq('id', matchupData.league_week_id)
        .single();

      let loadedSeasonData: Season | null = null;

      if (weekData) {
        const { data: seasonData } = await supabase
          .from('seasons')
          .select('*')
          .eq('id', weekData.season_id)
          .single();

        if (seasonData) {
          setSeason(seasonData);
          loadedSeasonData = seasonData;
        }

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const isAdmin = userRole?.role === 'org_admin' || userRole?.role === 'league_director';

        const { data: isTeamMember } = await supabase
          .from('team_players')
          .select('id')
          .eq('user_id', session.user.id)
          .in('team_id', [matchupData.home_team_id, matchupData.away_team_id])
          .maybeSingle();

        const { data: isTeamCaptain } = await supabase
          .from('teams')
          .select('id')
          .eq('captain_user_id', session.user.id)
          .in('id', [matchupData.home_team_id, matchupData.away_team_id])
          .maybeSingle();

        setCanEdit(isAdmin || !!isTeamMember || !!isTeamCaptain);

        const { data: homeCaptain } = await supabase
          .from('team_players')
          .select('is_captain')
          .eq('team_id', matchupData.home_team_id)
          .eq('user_id', session.user.id)
          .eq('is_captain', true)
          .maybeSingle();

        const { data: awayCaptain } = await supabase
          .from('team_players')
          .select('is_captain')
          .eq('team_id', matchupData.away_team_id)
          .eq('user_id', session.user.id)
          .eq('is_captain', true)
          .maybeSingle();

        setIsCaptain({
          home: !!homeCaptain || isAdmin,
          away: !!awayCaptain || isAdmin,
        });
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('matchup_id', params.matchupId)
        .order('match_number_in_matchup', { ascending: true });

      if (matchesError) {
        console.error('Error loading matches:', matchesError);
      }

      if (matchesData && matchesData.length > 0) {
        setMatches(matchesData as any);
        await loadTeamPlayers(matchupData.home_team_id, matchupData.away_team_id);
        await loadLineups();
      } else if (loadedSeasonData) {
        await createMatches(matchupData, loadedSeasonData);
        await loadTeamPlayers(matchupData.home_team_id, matchupData.away_team_id);
      }
    } catch (error) {
      console.error('Error loading matchup:', error);
      toast({
        title: 'Error',
        description: 'Failed to load matchup data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamPlayers = async (homeTeamId: string, awayTeamId: string) => {
    const { data: homePlayers } = await supabase
      .from('team_players')
      .select('*, profiles(*)')
      .eq('team_id', homeTeamId);

    const { data: awayPlayers } = await supabase
      .from('team_players')
      .select('*, profiles(*)')
      .eq('team_id', awayTeamId);

    if (homePlayers) setHomeTeamPlayers(homePlayers);
    if (awayPlayers) setAwayTeamPlayers(awayPlayers);
  };

  const loadLineups = async (matchesToLoad?: Match[]) => {
    const matchList = matchesToLoad || matches;
    if (matchList.length === 0) return;

    const matchIds = matchList.map(m => m.id);
    const { data } = await supabase
      .from('match_lineups')
      .select('*')
      .in('match_id', matchIds);

    if (data) {
      setLineups(data);
    }
  };

  const saveLineup = async (matchId: string, teamId: string, player1Id: string, player2Id: string) => {
    if (!currentUserId) return;

    try {
      const existingLineup = lineups.find(l => l.match_id === matchId && l.team_id === teamId);

      if (existingLineup) {
        const { error } = await supabase
          .from('match_lineups')
          .update({
            player1_id: player1Id,
            player2_id: player2Id,
            submitted_by: currentUserId,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingLineup.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('match_lineups')
          .insert({
            match_id: matchId,
            team_id: teamId,
            player1_id: player1Id,
            player2_id: player2Id,
            submitted_by: currentUserId,
            submitted_at: new Date().toISOString(),
            status: 'submitted',
          });

        if (error) throw error;
      }

      await loadLineups();

      toast({
        title: 'Success',
        description: 'Lineup saved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const createMatches = async (matchupData: any, seasonData: Season) => {
    const { data: weekData } = await supabase
      .from('league_weeks')
      .select('season_id')
      .eq('id', matchupData.league_week_id)
      .single();

    if (!weekData) {
      console.error('Week data not found');
      return;
    }

    const { data: leagueData } = await supabase
      .from('seasons')
      .select('league_id')
      .eq('id', weekData.season_id)
      .single();

    if (!leagueData) {
      console.error('League data not found');
      return;
    }

    const { data: orgData } = await supabase
      .from('leagues')
      .select('organization_id')
      .eq('id', leagueData.league_id)
      .single();

    if (!orgData) {
      console.error('Organization data not found');
      return;
    }

    const newMatches: Partial<Match>[] = [];

    const matchDate = matchupData.scheduled_time || new Date().toISOString();

    for (let i = 1; i <= seasonData.matches_per_matchup; i++) {
      newMatches.push({
        matchup_id: matchupData.id,
        match_number_in_matchup: i,
        team1_id: matchupData.home_team_id,
        team2_id: matchupData.away_team_id,
        team_id: matchupData.home_team_id,
        season_id: weekData.season_id,
        organization_id: orgData.organization_id,
        match_date: matchDate,
        status: 'pending',
        is_tiebreaker: false,
      });
    }

    const { data: insertedMatches, error } = await supabase
      .from('matches')
      .insert(newMatches as any)
      .select();

    if (!error && insertedMatches) {
      setMatches(insertedMatches as any);
      await loadLineups(insertedMatches as any);
    } else if (error) {
      console.error('Error creating matches:', error);
      toast({
        title: 'Error',
        description: 'Failed to create matches: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const updateMatchScore = async (matchId: string, team1Score: number, team2Score: number) => {
    if (!season) return;

    let winnerId: string | null = null;
    let status = 'in_progress';

    if (team1Score >= season.game_to || team2Score >= season.game_to) {
      if (season.win_by_2) {
        if (Math.abs(team1Score - team2Score) >= 2) {
          winnerId = team1Score > team2Score ? matchup?.home_team_id || null : matchup?.away_team_id || null;
          status = 'completed';
        }
      } else {
        winnerId = team1Score > team2Score ? matchup?.home_team_id || null : matchup?.away_team_id || null;
        status = 'completed';
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          team1_score: team1Score,
          team2_score: team2Score,
          winner_team_id: winnerId,
          status,
        })
        .eq('id', matchId);

      if (error) throw error;

      setMatches(prev => prev.map(m =>
        m.id === matchId
          ? { ...m, team1_score: team1Score, team2_score: team2Score, winner_team_id: winnerId, status }
          : m
      ));

      await updateMatchupScore();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateMatchupScore = async () => {
    if (!matchup) return;

    const homeWins = matches.filter(m => m.winner_team_id === matchup.home_team_id).length;
    const awayWins = matches.filter(m => m.winner_team_id === matchup.away_team_id).length;
    const allMatchesComplete = matches.every(m => m.status === 'completed');

    const { error } = await supabase
      .from('team_matchups')
      .update({
        home_matchup_wins: homeWins,
        away_matchup_wins: awayWins,
        status: allMatchesComplete ? 'completed' : 'in_progress',
        finalized: allMatchesComplete,
      })
      .eq('id', matchup.id);

    if (!error) {
      setMatchup(prev => prev ? {
        ...prev,
        home_matchup_wins: homeWins,
        away_matchup_wins: awayWins,
        status: allMatchesComplete ? 'completed' : 'in_progress',
        finalized: allMatchesComplete,
      } : null);
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!matchup) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Matchup not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/dashboard/leagues/${params.id}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to League
        </Button>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Match Details</h1>
          {matchup.finalized && (
            <Badge className="bg-green-600">
              <Check className="h-4 w-4 mr-1" />
              Completed
            </Badge>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Matchup Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-2xl font-bold mb-2">{matchup.home_team?.name}</div>
              <div className="text-sm text-muted-foreground mb-4">Home</div>
              <div className="text-5xl font-bold">{matchup.home_matchup_wins}</div>
            </div>
            <div className="text-3xl font-bold text-muted-foreground px-8">-</div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold mb-2">{matchup.away_team?.name}</div>
              <div className="text-sm text-muted-foreground mb-4">Away</div>
              <div className="text-5xl font-bold">{matchup.away_matchup_wins}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canEdit && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You can only view this matchup. To enter scores, you must be the league creator, a team member, or an organization admin.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="lineups" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lineups">Lineups</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
        </TabsList>

        <TabsContent value="lineups" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Set Lineups - {matches.length} Matches</CardTitle>
              <CardDescription>
                Assign 2 players for each match. Total slots: {matches.length * 4} ({matches.length * 2} per team)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No matches have been created yet. Refresh the page to create matches for this matchup.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
  {matches.map((match) => {
    const homeLineup = lineups.find(l => l.match_id === match.id && l.team_id === matchup.home_team_id);
    const awayLineup = lineups.find(l => l.match_id === match.id && l.team_id === matchup.away_team_id);

    const canEdit = isCaptain.home || isCaptain.away;
    const isHomeCaptain = isCaptain.home;
    const isAwayCaptain = isCaptain.away;
    const isEditing = editingMatchId === match.id;

    return (
      <div
        key={match.id}
        className="bg-card border rounded-lg shadow-sm overflow-hidden"
      >
        <div className="bg-muted px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">
              {match.match_number_in_matchup === 1 ? "1ST MATCH" :
               match.match_number_in_matchup === 2 ? "2ND MATCH" :
               `${match.match_number_in_matchup}TH MATCH`}
              {match.is_tiebreaker && (
                <Badge variant="outline" className="ml-2 text-xs align-middle">
                  {season?.tiebreaker_name || 'TB'}
                </Badge>
              )}
            </h3>
            {match.status === 'pending' && canEdit && !isEditing && (
              <span className="text-sm text-muted-foreground italic">
                Waiting to be Selected...
              </span>
            )}
          </div>
        </div>

        <div className="p-4 space-y-5">
          <div className="space-y-3">
            <div className="font-medium text-muted-foreground">
              {matchup.home_team?.name} (Home)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                {isHomeCaptain && isEditing ? (
                  <Select
                    value={homeLineup?.player1_id || ''}
                    onValueChange={(value) => {
                      const player2 = homeLineup?.player2_id || '';
                      if (value && player2 && value !== player2) {
                        saveLineup(match.id, matchup.home_team_id, value, player2);
                      } else if (value && !player2) {
                        const newLineup = { ...homeLineup, player1_id: value };
                        setLineups(prev => {
                          const filtered = prev.filter(l => !(l.match_id === match.id && l.team_id === matchup.home_team_id));
                          return [...filtered, newLineup as Lineup];
                        });
                      }
                    }}
                    disabled={matchup.finalized}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Player 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {homeTeamPlayers.map((player) => (
                        <SelectItem key={player.user_id} value={player.user_id}>
                          {player.profiles?.full_name || 'Unknown'}
                          {player.is_substitute && ' (Sub)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm border rounded-md px-3 py-2 bg-muted/40">
                    {homeLineup?.player1_id
                      ? homeTeamPlayers.find(p => p.user_id === homeLineup.player1_id)?.profiles?.full_name || 'Unknown'
                      : '—'}
                  </div>
                )}
              </div>

              <div>
                {isHomeCaptain && isEditing ? (
                  <Select
                    value={homeLineup?.player2_id || ''}
                    onValueChange={(value) => {
                      const player1 = homeLineup?.player1_id || '';
                      if (value && player1 && value !== player1) {
                        saveLineup(match.id, matchup.home_team_id, player1, value);
                      } else if (value && !player1) {
                        const newLineup = { ...homeLineup, player2_id: value };
                        setLineups(prev => {
                          const filtered = prev.filter(l => !(l.match_id === match.id && l.team_id === matchup.home_team_id));
                          return [...filtered, newLineup as Lineup];
                        });
                      }
                    }}
                    disabled={matchup.finalized}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Player 2" />
                    </SelectTrigger>
                    <SelectContent>
                      {homeTeamPlayers.map((player) => (
                        <SelectItem key={player.user_id} value={player.user_id}>
                          {player.profiles?.full_name || 'Unknown'}
                          {player.is_substitute && ' (Sub)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm border rounded-md px-3 py-2 bg-muted/40">
                    {homeLineup?.player2_id
                      ? homeTeamPlayers.find(p => p.user_id === homeLineup.player2_id)?.profiles?.full_name || 'Unknown'
                      : '—'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-orange-400" />
            </div>
            <div className="relative flex items-center gap-3 bg-background px-4">
              <span className="text-xl font-bold text-orange-500">vs</span>

              {canEdit && !matchup.finalized && (
                isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-green-400 text-green-600 hover:bg-green-50"
                    onClick={() => setEditingMatchId(null)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Done
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-orange-400 text-orange-600 hover:bg-orange-50"
                    onClick={() => setEditingMatchId(match.id)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit Players
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-medium text-muted-foreground">
              {matchup.away_team?.name} (Away)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                {isAwayCaptain && isEditing ? (
                  <Select
                    value={awayLineup?.player1_id || ''}
                    onValueChange={(value) => {
                      const player2 = awayLineup?.player2_id || '';
                      if (value && player2 && value !== player2) {
                        saveLineup(match.id, matchup.away_team_id, value, player2);
                      } else if (value && !player2) {
                        const newLineup = { ...awayLineup, player1_id: value };
                        setLineups(prev => {
                          const filtered = prev.filter(l => !(l.match_id === match.id && l.team_id === matchup.away_team_id));
                          return [...filtered, newLineup as Lineup];
                        });
                      }
                    }}
                    disabled={matchup.finalized}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Player 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {awayTeamPlayers.map((player) => (
                        <SelectItem key={player.user_id} value={player.user_id}>
                          {player.profiles?.full_name || 'Unknown'}
                          {player.is_substitute && ' (Sub)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm border rounded-md px-3 py-2 bg-muted/40">
                    {awayLineup?.player1_id
                      ? awayTeamPlayers.find(p => p.user_id === awayLineup.player1_id)?.profiles?.full_name || 'Unknown'
                      : '—'}
                  </div>
                )}
              </div>

              <div>
                {isAwayCaptain && isEditing ? (
                  <Select
                    value={awayLineup?.player2_id || ''}
                    onValueChange={(value) => {
                      const player1 = awayLineup?.player1_id || '';
                      if (value && player1 && value !== player1) {
                        saveLineup(match.id, matchup.away_team_id, player1, value);
                      } else if (value && !player1) {
                        const newLineup = { ...awayLineup, player2_id: value };
                        setLineups(prev => {
                          const filtered = prev.filter(l => !(l.match_id === match.id && l.team_id === matchup.away_team_id));
                          return [...filtered, newLineup as Lineup];
                        });
                      }
                    }}
                    disabled={matchup.finalized}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Player 2" />
                    </SelectTrigger>
                    <SelectContent>
                      {awayTeamPlayers.map((player) => (
                        <SelectItem key={player.user_id} value={player.user_id}>
                          {player.profiles?.full_name || 'Unknown'}
                          {player.is_substitute && ' (Sub)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm border rounded-md px-3 py-2 bg-muted/40">
                    {awayLineup?.player2_id
                      ? awayTeamPlayers.find(p => p.user_id === awayLineup.player2_id)?.profiles?.full_name || 'Unknown'
                      : '—'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  })}
</div>
              )}

              {matches.length > 0 && (isCaptain.home || isCaptain.away) && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Select both players for each match to save the lineup.
                    Players marked with (Sub) are substitutes. Both regular roster members and substitutes can be assigned to any match.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Individual Matches</CardTitle>
              <CardDescription>
                Enter scores for each match (First to {season?.game_to} points
                {season?.win_by_2 ? ', win by 2' : ''})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {matches.map((match, index) => (
                  <Card key={match.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            Match {match.match_number_in_matchup}
                            {match.is_tiebreaker && ` (${season?.tiebreaker_name || 'Tiebreaker'})`}
                          </h3>
                          {match.status === 'completed' && (
                            <Badge variant="outline">
                              <Check className="h-3 w-3 mr-1" />
                              Complete
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>{matchup.home_team?.name} (Home)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={match.team1_score || 0}
                            onChange={(e) => {
                              const newScore = parseInt(e.target.value) || 0;
                              updateMatchScore(match.id, newScore, match.team2_score || 0);
                            }}
                            disabled={!canEdit || matchup.finalized}
                          />
                        </div>

                        <div className="relative flex items-center justify-center py-2">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                          </div>
                          <div className="relative bg-background px-4">
                            <span className="text-base font-semibold text-muted-foreground">VS</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>{matchup.away_team?.name} (Away)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={match.team2_score || 0}
                            onChange={(e) => {
                              const newScore = parseInt(e.target.value) || 0;
                              updateMatchScore(match.id, match.team1_score || 0, newScore);
                            }}
                            disabled={!canEdit || matchup.finalized}
                          />
                        </div>
                      </div>

                      {match.winner_team_id && (
                        <div className="mt-4 text-center">
                          <Badge className="bg-green-600">
                            <Trophy className="h-3 w-3 mr-1" />
                            Winner: {match.winner_team_id === matchup.home_team_id
                              ? matchup.home_team?.name
                              : matchup.away_team?.name}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
