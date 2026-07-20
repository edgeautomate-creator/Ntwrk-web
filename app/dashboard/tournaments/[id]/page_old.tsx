'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, MapPin, Users, Trophy, Copy, Check, CircleAlert as AlertCircle, UserPlus, CreditCard as Edit2, X, Pencil, Loader as Loader2, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayoffBracket } from '@/components/playoff-bracket';
import { RemovePlayerConfirmDialog } from '@/components/remove-player-confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { getDisplayName } from '@/lib/utils';
import { KingOfTheHillPage } from './king-of-the-hill-page';

export interface Tournament {
  id: string;
  name: string;
  date: string | null;
  start_time: string | null;
  location: string | null;
  expected_teams: number;
  playoff_teams: number;
  playoff_byes: number;
  format: string;
  registration_type?: 'team' | 'individual';
  player_capacity?: number;
  has_playoffs?: boolean;
  playoff_qualifiers?: number;
  best_of: number;
  is_private: boolean;
  access_code: string | null;
  share_token: string;
  created_by: string;
  created_at: string;
  is_dupr_required: boolean;
  playoffs_started: boolean;
  playoffs_started_at: string | null;
  champion_team_id: string | null;
  team_format?: 'singles' | 'doubles';
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  team_number: number;
  team_name: string | null;
  player1_name: string | null;
  player1_dupr_id: string | null;
  player1_rating: number | null;
  player1_user_id: string | null;
  player2_name: string | null;
  player2_dupr_id: string | null;
  player2_rating: number | null;
  player2_user_id: string | null;
  claimed_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  match_number: number;
  round: string;
  team1_id: string;
  team2_id: string;
  team1_score: number | null;
  team2_score: number | null;
  team1_games_won: number | null;
  team2_games_won: number | null;
  winner_team_id: string | null;
  status: 'scheduled' | 'in_progress' | 'completed';
  scheduled_time: string | null;
  completed_at: string | null;
  is_playoff_match: boolean;
  playoff_round: string | null;
  bracket_position: number | null;
  seeding_position_team1: number | null;
  seeding_position_team2: number | null;
  dupr_match_id: number | null;
  dupr_match_identifier: string | null;
  game1_team1_points: number | null;
  game1_team2_points: number | null;
  game2_team1_points: number | null;
  game2_team2_points: number | null;
  game3_team1_points: number | null;
  game3_team2_points: number | null;
  game4_team1_points: number | null;
  game4_team2_points: number | null;
  game5_team1_points: number | null;
  game5_team2_points: number | null;
  team1?: TournamentTeam;
  team2?: TournamentTeam;
}

interface TeamStanding {
  id: string;
  tournament_id: string;
  team_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_differential: number;
  team?: TournamentTeam;
}


export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TournamentTeam | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<'player1' | 'player2' | null>(null);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [claimError, setClaimError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [team1Score, setTeam1Score] = useState('');
  const [team2Score, setTeam2Score] = useState('');
  const [games, setGames] = useState<Array<{ team1Points: string; team2Points: string }>>([
    { team1Points: '', team2Points: '' },
    { team1Points: '', team2Points: '' },
    { team1Points: '', team2Points: '' },
  ]);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
  const [editedTeamName, setEditedTeamName] = useState('');
  const [editingPlayerSlot, setEditingPlayerSlot] = useState<{ teamId: string; slot: 'player1' | 'player2' } | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [showRemovePlayerDialog, setShowRemovePlayerDialog] = useState(false);
  const [playerToRemoveFromTeam, setPlayerToRemoveFromTeam] = useState<{ team: TournamentTeam; slot: 'player1' | 'player2' } | null>(null);
  const [removingPlayerFromTeam, setRemovingPlayerFromTeam] = useState(false);
  const [activeTab, setActiveTab] = useState('teams');
  const [startingPlayoffs, setStartingPlayoffs] = useState(false);
  const [playoffMatches, setPlayoffMatches] = useState<TournamentMatch[]>([]);
  const [claimingSlot, setClaimingSlot] = useState<{ teamId: string; slot: 'player1' | 'player2' } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteTournament, setShowDeleteTournament] = useState(false);
  const [isDeleteTournamentShow, setIsDeleteTournamentShow] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [matchGameScores, setMatchGameScores] = useState<Record<string, Array<{ team1: number; team2: number }>>>({});

  useEffect(() => {
    loadTournamentData();
  }, [params.id]);


  const handleShareStandings = () => {
    if (!tournament || standings.length === 0) return;

    const eventName = tournament.name?.trim() || "Tournament";
    let text = `${eventName} Standings\n\n`;

    // Determine if there's a clear/single winner for the trophy
    const maxWins = Math.max(...standings.map(s => s.wins ?? 0));
    const hasClearWinner = standings.filter(s => (s.wins ?? 0) === maxWins).length === 1;

    standings.forEach((s, index) => {
      const rank = index + 1;
      const trophy = (s.wins === maxWins && hasClearWinner) ? '🏆 ' : '   '; // space to keep alignment

      const teamName = s.team?.team_name?.trim() || `Team ${s.team?.team_number ?? '?'}`;
      const players = formatTeamPlayersAmp(s.team)?.trim();
      const playerPart = players && players !== '—' ? ` (${players})` : '';

      const wl = `${s.wins ?? 0}-${s.losses ?? 0}`;
      const pf = s.points_for ?? 0;
      const pa = s.points_against ?? 0;
      const diff = s.point_differential ?? 0;
      const diffStr = diff >= 0 ? `+${diff}` : diff.toString();

      text += `${rank}. ${trophy}${teamName}${playerPart}\n`;
      text += `   W-L : ${wl} | PF: ${pf} | PA: ${pa} | Diff: ${diffStr}\n\n`;
    });

    // Optional champion line (especially useful after finals)
    if (tournament.champion_team_id) {
      const champ = teams.find(t => t.id === tournament.champion_team_id);
      if (champ) {
        text += `\n🏆 Champion: ${formatTeamPlayersAmp(champ)}\n`;
      }
    }

    navigator.clipboard.writeText(text.trim());
    setShareCopied(true);
    toast({
      title: "Standings copied",
      description: "Team standings ready to paste",
    });
    setTimeout(() => setShareCopied(false), 2200);
  };



  const loadTournamentData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setCurrentUserId(session.user.id);

      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', params.id)
        .single();

      if (tournamentError) throw tournamentError;

      setTournament(tournamentData);
      setIsCreator(tournamentData.created_by === session.user.id);

      const { data: teamsData } = await supabase
        .from('tournament_teams')
        .select('*')
        .eq('tournament_id', params.id)
        .order('team_number', { ascending: true });

      setTeams(teamsData || []);

      await loadMatches();
      await loadStandings();
    } catch (error) {
      console.error('Error loading tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    const { data: matchesData } = await supabase
      .from('tournament_matches')
      .select('*, team1:tournament_teams!team1_id(*), team2:tournament_teams!team2_id(*)')
      .eq('tournament_id', params.id)
      .eq('is_playoff_match', false)
      .is('deleted_at', null)
      .order('match_number', { ascending: true });

    if (matchesData) {
      setMatches(matchesData as any);
    }

    const { count } = await supabase
  .from('tournament_matches')
  .select('*', { count: 'exact', head: true })
  .eq('tournament_id', params.id)
  .eq('is_playoff_match', false);


  setIsDeleteTournamentShow(!count)



    const { data: playoffData } = await supabase
      .from('tournament_matches')
      .select('*, team1:tournament_teams!team1_id(*), team2:tournament_teams!team2_id(*)')
      .eq('tournament_id', params.id)
      .eq('is_playoff_match', true)
      .is('deleted_at', null)
      .order('bracket_position', { ascending: true });

    if (playoffData) {
      setPlayoffMatches(playoffData as any);
    }
  };

  const loadStandings = async () => {
    const { data: standingsData } = await supabase
      .from('team_standings')
      .select('*, team:tournament_teams(*)')
      .eq('tournament_id', params.id)
      .order('wins', { ascending: false })
      .order('point_differential', { ascending: false });

    if (standingsData) {
      setStandings(standingsData as any);
    }
  };

  const updateTeamName = async (teamId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('tournament_teams')
        .update({ team_name: newName, updated_at: new Date().toISOString() })
        .eq('id', teamId);

      if (error) throw error;

      setEditingTeamName(null);
      setEditedTeamName('');
      await loadTournamentData();
    } catch (error) {
      console.error('Error updating team name:', error);
      alert('Failed to update team name');
    }
  };

  const teamHasStartedGames = (teamId: string) => {
    const allMatches = [...matches, ...playoffMatches];
    return allMatches.some(
      (m) =>
        (m.team1_id === teamId || m.team2_id === teamId) &&
        (m.status === 'in_progress' || m.status === 'completed')
    );
  };

  const hasUserClaimedSpotInTournament = (userId: string | null) => {
    if (!userId) return false;
    return teams.some(
      (t) => t.player1_user_id === userId || t.player2_user_id === userId
    );
  };

  const canRemovePlayerFromTeam = (team: TournamentTeam, slot: 'player1' | 'player2') => {
    if (!isCreator) return false;
    if (teamHasStartedGames(team.id)) return false;
    return slot === 'player1' ? !!team.player1_name : !!team.player2_name;
  };

  const openRemovePlayerFromTeamDialog = (team: TournamentTeam, slot: 'player1' | 'player2') => {
    const playerName = slot === 'player1' ? team.player1_name : team.player2_name;
    if (!playerName) return;
    setPlayerToRemoveFromTeam({ team, slot });
    setShowRemovePlayerDialog(true);
  };

  const confirmRemovePlayerFromTeam = async () => {
    if (!playerToRemoveFromTeam) return;
    const { team, slot } = playerToRemoveFromTeam;
    setRemovingPlayerFromTeam(true);
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        ...(slot === 'player1'
          ? { player1_name: null, player1_dupr_id: null, player1_rating: null, player1_user_id: null }
          : { player2_name: null, player2_dupr_id: null, player2_rating: null, player2_user_id: null }),
      };
      if (slot === 'player1' && team.claimed_by_user_id === team.player1_user_id) {
        updateData.claimed_by_user_id = team.player2_user_id ?? null;
      }
      const { error } = await supabase
        .from('tournament_teams')
        .update(updateData)
        .eq('id', team.id);
      if (error) throw error;
      toast({ title: 'Player removed', description: 'The spot is now open for someone else to claim.' });
      await loadTournamentData();
      setShowRemovePlayerDialog(false);
      setPlayerToRemoveFromTeam(null);
    } catch (error) {
      console.error('Error removing player:', error);
      toast({ title: 'Error', description: 'Failed to remove player', variant: 'destructive' });
    } finally {
      setRemovingPlayerFromTeam(false);
    }
  };

  const canEditTournamentPlayerName = (team: TournamentTeam, slot: 'player1' | 'player2') => {
    if (!tournament || tournament.is_dupr_required) return false;
    if (isCreator) return true;
    const uid = currentUserId;
    return (slot === 'player1' && team.player1_user_id === uid) || (slot === 'player2' && team.player2_user_id === uid);
  };

  const handleSaveTournamentPlayerName = async () => {
    if (!editingPlayerSlot || !editingPlayerName.trim()) return;
    try {
      const { teamId, slot } = editingPlayerSlot;
      const col = slot === 'player1' ? 'player1_name' : 'player2_name';
      const { error } = await supabase
        .from('tournament_teams')
        .update({ [col]: editingPlayerName.trim(), updated_at: new Date().toISOString() })
        .eq('id', teamId);
      if (error) throw error;
      setEditingPlayerSlot(null);
      setEditingPlayerName('');
      toast({ title: 'Name updated' });
      await loadTournamentData();
    } catch (error) {
      console.error('Error updating player name:', error);
      toast({ title: 'Error', description: 'Failed to update name', variant: 'destructive' });
    }
  };

  const isSingles = tournament?.team_format === 'singles';
  const isTeamFilled = (t: TournamentTeam) =>
    isSingles ? !!t.player1_name : !!(t.player1_name && t.player2_name);

  const generateSchedule = async () => {
    if (!tournament) return;

    try {
      setGeneratingSchedule(true);

      const filledTeams = teams.filter(isTeamFilled);

      if (filledTeams.length < 2) {
        setGeneratingSchedule(false);
        alert('Need at least 2 complete teams to generate a schedule');
        return;
      }

      // Use the proper round-robin algorithm from schedule-generator
      const { generateRoundRobinPairings } = await import('@/lib/schedule-generator');
      const pairings = generateRoundRobinPairings(filledTeams.length);

      // Convert pairings to tournament matches
      const matchesToCreate = pairings.map((pairing, index) => ({
        tournament_id: tournament.id,
        match_number: index + 1,
        round: `Round ${pairing.roundNumber}`,
        team1_id: filledTeams[pairing.participant1Index].id,
        team2_id: filledTeams[pairing.participant2Index].id,
        status: 'scheduled',
        is_playoff_match: false,
      }));

      const { error } = await supabase
        .from('tournament_matches')
        .insert(matchesToCreate);

      if (error) {
        console.error('Error creating matches:', error);
        throw error;
      }

      await loadMatches();
      setActiveTab('schedule');
    } catch (error: any) {
      console.error('Error generating schedule:', error);
      alert(`Failed to generate schedule: ${error.message || 'Unknown error'}`);
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const canUserEnterScore = (match: TournamentMatch): boolean => {
    if (!currentUserId) return false;

    // Tournament creator can always enter scores
    if (tournament?.created_by === currentUserId) return true;

    // Check if user is a participant in this match
    const team1 = teams.find(t => t.id === match.team1_id);
    const team2 = teams.find(t => t.id === match.team2_id);

    const isInTeam1 = team1?.player1_user_id === currentUserId || team1?.player2_user_id === currentUserId;
    const isInTeam2 = team2?.player1_user_id === currentUserId || team2?.player2_user_id === currentUserId;

    return isInTeam1 || isInTeam2;
  };

  const openScoreDialog = async (match: TournamentMatch) => {
    if (!canUserEnterScore(match)) {
      alert('Only tournament participants or the tournament creator can enter scores');
      return;
    }

    setSelectedMatch(match);

    // Fetch match data with game scores from database
    const { data: matchData } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', match.id)
      .single();

    // Initialize games array based on existing game data
    const gamesData = [];
    if (matchData?.game1_team1_points != null && matchData?.game1_team2_points != null) {
      gamesData.push({ team1Points: matchData.game1_team1_points.toString(), team2Points: matchData.game1_team2_points.toString() });
    }
    if (matchData?.game2_team1_points != null && matchData?.game2_team2_points != null) {
      gamesData.push({ team1Points: matchData.game2_team1_points.toString(), team2Points: matchData.game2_team2_points.toString() });
    }
    if (matchData?.game3_team1_points != null && matchData?.game3_team2_points != null) {
      gamesData.push({ team1Points: matchData.game3_team1_points.toString(), team2Points: matchData.game3_team2_points.toString() });
    }
    if (matchData?.game4_team1_points != null && matchData?.game4_team2_points != null) {
      gamesData.push({ team1Points: matchData.game4_team1_points.toString(), team2Points: matchData.game4_team2_points.toString() });
    }
    if (matchData?.game5_team1_points != null && matchData?.game5_team2_points != null) {
      gamesData.push({ team1Points: matchData.game5_team1_points.toString(), team2Points: matchData.game5_team2_points.toString() });
    }

    // If no game data exists, start with default 3 empty games
    if (gamesData.length === 0) {
      setGames([
        { team1Points: '', team2Points: '' },
        { team1Points: '', team2Points: '' },
        { team1Points: '', team2Points: '' },
      ]);
    } else {
      setGames(gamesData);
    }

    // Calculate team scores from games (games won)
    const team1GamesWon = gamesData.filter((g, idx) => {
      const t1 = parseInt(g.team1Points);
      const t2 = parseInt(g.team2Points);
      return !isNaN(t1) && !isNaN(t2) && t1 > t2;
    }).length;
    const team2GamesWon = gamesData.filter((g, idx) => {
      const t1 = parseInt(g.team1Points);
      const t2 = parseInt(g.team2Points);
      return !isNaN(t1) && !isNaN(t2) && t2 > t1;
    }).length;

    setTeam1Score(team1GamesWon > 0 ? team1GamesWon.toString() : '');
    setTeam2Score(team2GamesWon > 0 ? team2GamesWon.toString() : '');
    setShowScoreDialog(true);
  };

  const handleDeleteMatch = async () => {
    if (!selectedMatch || !isCreator) return;

    try {
      setDeleting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.rpc('delete_tournament_match', {
        p_match_id: selectedMatch.id
      });

      if (error) throw error;

      const result = data as any;

      if (result.needs_dupr_deletion) {
        try {
          const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-delete-match`;
          const { data: { session: freshSession } } = await supabase.auth.getSession();

          const res = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${freshSession?.access_token}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              matchId: result.dupr_match_id,
              matchIdentifier: result.dupr_match_identifier
            }),
          });

          const duprResult = await res.json();

          if (!res.ok) {
            toast({
              title: 'Match deleted locally',
              description: 'Failed to delete from DUPR. You may need to delete it manually.',
              variant: 'default',
            });
          } else {
            toast({
              title: 'Match deleted',
              description: 'Match deleted successfully from both local database and DUPR.',
            });
          }
        } catch (duprError) {
          console.error('DUPR deletion error:', duprError);
          toast({
            title: 'Match deleted locally',
            description: 'Failed to delete from DUPR. You may need to delete it manually.',
            variant: 'default',
          });
        }
      } else {
        toast({
          title: 'Match deleted',
          description: 'Match deleted successfully.',
        });
      }

      setShowScoreDialog(false);
      setShowDeleteDialog(false);
      await loadMatches();
      await loadStandings();
      await loadTournamentData();
    } catch (error: any) {
      console.error('Error deleting match:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete match',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const submitScore = async () => {
    if (!selectedMatch) return;

    // Validate that at least one game has scores
    const validGames = games.filter(g => {
      const t1 = parseInt(g.team1Points);
      const t2 = parseInt(g.team2Points);
      return !isNaN(t1) && !isNaN(t2) && t1 >= 0 && t2 >= 0;
    });

    if (validGames.length === 0) {
      toast({ title: 'Please enter at least one game score', variant: 'destructive' });
      return;
    }

    // Validate game scores are between 0-30
    for (const game of validGames) {
      const t1 = parseInt(game.team1Points);
      const t2 = parseInt(game.team2Points);
      if (t1 < 0 || t1 > 30 || t2 < 0 || t2 > 30) {
        toast({ title: 'Game scores must be between 0 and 30', variant: 'destructive' });
        return;
      }
      if (t1 === t2) {
        toast({ title: 'Game scores cannot be tied', variant: 'destructive' });
        return;
      }
    }

    // Calculate games won for each team
    const team1GamesWon = validGames.filter(g => parseInt(g.team1Points) > parseInt(g.team2Points)).length;
    const team2GamesWon = validGames.filter(g => parseInt(g.team2Points) > parseInt(g.team1Points)).length;

    if (team1GamesWon === team2GamesWon) {
      toast({ title: 'Match cannot be tied. One team must win more games.', variant: 'destructive' });
      return;
    }

    try {
      const winnerId = team1GamesWon > team2GamesWon ? selectedMatch.team1_id : selectedMatch.team2_id;

      // Prepare game score data
      const updateData: any = {
        team1_score: team1GamesWon,
        team2_score: team2GamesWon,
        winner_team_id: winnerId,
        status: 'completed',
        completed_at: new Date().toISOString(),
        game1_team1_points: null,
        game1_team2_points: null,
        game2_team1_points: null,
        game2_team2_points: null,
        game3_team1_points: null,
        game3_team2_points: null,
        game4_team1_points: null,
        game4_team2_points: null,
        game5_team1_points: null,
        game5_team2_points: null,
      };

      // Set game scores
      validGames.forEach((game, idx) => {
        if (idx < 5) {
          updateData[`game${idx + 1}_team1_points`] = parseInt(game.team1Points);
          updateData[`game${idx + 1}_team2_points`] = parseInt(game.team2Points);
        }
      });

      const { error } = await supabase
        .from('tournament_matches')
        .update(updateData)
        .eq('id', selectedMatch.id);

      if (error) throw error;

      if (selectedMatch.is_playoff_match && selectedMatch.playoff_round === 'Finals' && winnerId) {
        await supabase
          .from('tournaments')
          .update({ champion_team_id: winnerId })
          .eq('id', tournament?.id);
      }

      setShowScoreDialog(false);
      await loadMatches();
      await loadStandings();
      await loadTournamentData();

      // Best-effort sync to DUPR (create or update club match)
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-create-club-match`;
        const { data: { session: authSession } } = await supabase.auth.getSession();

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession?.access_token}`,
          },
          body: JSON.stringify({ matchId: selectedMatch.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.synced) {
          toast({ title: 'Score saved', description: 'Synced to DUPR.', variant: 'default' });
        } else if (data.reason && res.ok) {
          // no_club or missing_player_dupr_ids - not an error, just skip
        } else if (!res.ok) {
          toast({ title: 'DUPR sync failed', description: data.error || 'Could not sync match to DUPR.', variant: 'destructive' });
        }
      } catch (duprErr) {
        console.error('DUPR sync error:', duprErr);
        toast({ title: 'DUPR sync failed', description: 'Score saved; sync to DUPR failed.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error submitting score:', error);
      alert('Failed to submit score');
    }
  };

  const startPlayoffs = async () => {
    if (!tournament) return;

    try {
      setStartingPlayoffs(true);

      const topTeams = standings
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.point_differential - a.point_differential;
        })
        .slice(0, tournament.playoff_teams);

      if (topTeams.length < 2) {
        alert('Need at least 2 teams with completed matches to start playoffs');
        return;
      }

      await supabase
        .from('tournaments')
        .update({
          playoffs_started: true,
          playoffs_started_at: new Date().toISOString(),
        })
        .eq('id', tournament.id);

      const playoffMatchesToCreate: any[] = [];
      let bracketPosition = 1;

      const rounds: Record<number, string> = {
        2: 'Finals',
        4: 'Semifinals',
        8: 'Quarterfinals',
        16: 'Round of 16',
      };

      const byeCount = tournament.playoff_byes || 0;
      const teamsPlayingRound1 = topTeams.length - byeCount;

      if (byeCount > 0) {
        const byeTeams = topTeams.slice(0, byeCount);
        const playingTeams = topTeams.slice(byeCount);

        const round1Matches = Math.floor(playingTeams.length / 2);
        const round1Name = rounds[Math.pow(2, Math.ceil(Math.log2(topTeams.length)))] || 'First Round';

        for (let i = 0; i < playingTeams.length; i += 2) {
          if (i + 1 < playingTeams.length) {
            playoffMatchesToCreate.push({
              tournament_id: tournament.id,
              match_number: 1000 + bracketPosition,
              round: round1Name,
              team1_id: playingTeams[i].team_id,
              team2_id: playingTeams[i + 1].team_id,
              seeding_position_team1: byeCount + i + 1,
              seeding_position_team2: byeCount + i + 2,
              status: 'scheduled',
              is_playoff_match: true,
              playoff_round: round1Name,
              bracket_position: bracketPosition,
            });
            bracketPosition++;
          }
        }
      } else {
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(topTeams.length)));
        const roundName = rounds[nextPowerOf2] || `Round of ${nextPowerOf2}`;

        for (let i = 0; i < topTeams.length; i += 2) {
          if (i + 1 < topTeams.length) {
            playoffMatchesToCreate.push({
              tournament_id: tournament.id,
              match_number: 1000 + bracketPosition,
              round: roundName,
              team1_id: topTeams[i].team_id,
              team2_id: topTeams[i + 1].team_id,
              seeding_position_team1: i + 1,
              seeding_position_team2: i + 2,
              status: 'scheduled',
              is_playoff_match: true,
              playoff_round: roundName,
              bracket_position: bracketPosition,
            });
            bracketPosition++;
          }
        }
      }

      const { error } = await supabase
        .from('tournament_matches')
        .insert(playoffMatchesToCreate);

      if (error) throw error;

      await loadMatches();
      await loadTournamentData();
      setActiveTab('playoffs');
    } catch (error) {
      console.error('Error starting playoffs:', error);
      alert('Failed to start playoffs');
    } finally {
      setStartingPlayoffs(false);
    }
  };


  const initiateClaimTeam = async (team: TournamentTeam, playerSlot: 'player1' | 'player2') => {
    setClaimingSlot({ teamId: team.id, slot: playerSlot });
    try {
      setClaimError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('dupr_id, dupr_rating, full_name, display_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (tournament?.is_dupr_required && !profile?.dupr_id) {
        toast({
          title: 'DUPR sign-in required',
          description: 'Please sign in with DUPR to claim a spot. This tournament requires DUPR authentication.',
          variant: 'destructive',
        });
        return;
      }

      if (tournament?.is_dupr_required && hasUserClaimedSpotInTournament(session.user.id)) {
        toast({
          title: 'Already registered',
          description: 'You can only claim one spot in DUPR-required tournaments.',
          variant: 'destructive',
        });
        return;
      }

      setSelectedTeam(team);
      setSelectedSlot(playerSlot);

      const displayName = getDisplayName({
        display_name: profile?.display_name,
        full_name: profile?.full_name,
        email: session.user.email
      }, 'Anonymous Player');

      if (tournament?.is_dupr_required) {
        await confirmClaimTeam(displayName, profile?.dupr_id || null, profile?.dupr_rating || null, team, playerSlot);
      } else {
        setClaimName(displayName);
        setShowClaimDialog(true);
      }
    } catch (error: any) {
      setClaimError(error.message);
    } finally {
      setClaimingSlot(null);
    }
  };

  const confirmClaimTeam = async (playerName: string, duprId: string | null = null, rating: number | null = null, team: TournamentTeam | null = null, playerSlot: 'player1' | 'player2' | null = null) => {
    try {
      if (!team || !playerSlot) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (playerSlot === 'player1') {
        updateData.player1_name = playerName;
        updateData.player1_dupr_id = duprId;
        updateData.player1_rating = rating;
        updateData.player1_user_id = session.user.id;
        if (!team.claimed_by_user_id) {
          updateData.claimed_by_user_id = session.user.id;
        }
      } else {
        updateData.player2_name = playerName;
        updateData.player2_dupr_id = duprId;
        updateData.player2_rating = rating;
        updateData.player2_user_id = session.user.id;
      }

      const { error } = await supabase
        .from('tournament_teams')
        .update(updateData)
        .eq('id', team.id);

      if (error) throw error;

      setShowClaimDialog(false);
      setSelectedTeam(null);
      setSelectedSlot(null);
      setClaimName('');
      await loadTournamentData();
    } catch (error: any) {
      setClaimError(error.message);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/dashboard/tournaments/${params.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAccessCode = () => {
    if (tournament?.access_code) {
      navigator.clipboard.writeText(tournament.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);

      if (error) {
        console.error('Error deleting tournament:', error);
        toast({
          title: 'Unable to delete tournament',
          description: 'This tournament has recorded scores or you do not have permission to delete it.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Tournament deleted',
          description: 'The tournament has been removed.',
        });
        router.push('/dashboard/tournaments');
      }
    } finally {
      setDeleting(false);
      setShowDeleteTournament(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Tournament not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Date TBD';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const filledTeams = teams.filter(isTeamFilled);

  const formatTeamPlayers = (team: TournamentTeam | null | undefined) => {
    if (!team) return '';
    if (isSingles) return team.player1_name ?? '—';
    const p1 = team.player1_name ?? '';
    const p2 = team.player2_name ?? '';
    if (p1 && p2) return `${p1} / ${p2}`;
    if (p1) return p1;
    if (p2) return p2;
    return '—';
  };

  const formatTeamPlayersAmp = (team: TournamentTeam | null | undefined) => {
    if (!team) return '';
    if (isSingles) return team.player1_name ?? '—';
    const p1 = team.player1_name ?? '';
    const p2 = team.player2_name ?? '';
    if (p1 && p2) return `${p1} & ${p2}`;
    if (p1) return p1;
    if (p2) return p2;
    return '—';
  };

  const getMatchGameScores = async (matchId: string): Promise<Array<{ team1: number; team2: number }> | null> => {
    const { data } = await supabase
      .from('tournament_matches')
      .select('game1_team1_points, game1_team2_points, game2_team1_points, game2_team2_points, game3_team1_points, game3_team2_points, game4_team1_points, game4_team2_points, game5_team1_points, game5_team2_points')
      .eq('id', matchId)
      .single();

    if (!data) return null;

    const gameScores = [];
    if (data.game1_team1_points != null && data.game1_team2_points != null) {
      gameScores.push({ team1: data.game1_team1_points, team2: data.game1_team2_points });
    }
    if (data.game2_team1_points != null && data.game2_team2_points != null) {
      gameScores.push({ team1: data.game2_team1_points, team2: data.game2_team2_points });
    }
    if (data.game3_team1_points != null && data.game3_team2_points != null) {
      gameScores.push({ team1: data.game3_team1_points, team2: data.game3_team2_points });
    }
    if (data.game4_team1_points != null && data.game4_team2_points != null) {
      gameScores.push({ team1: data.game4_team1_points, team2: data.game4_team2_points });
    }
    if (data.game5_team1_points != null && data.game5_team2_points != null) {
      gameScores.push({ team1: data.game5_team1_points, team2: data.game5_team2_points });
    }

    return gameScores.length > 0 ? gameScores : null;
  };

  // Detect King of the Hill format and render different interface
  if (tournament.format === 'king_of_the_hill') {
    return (
      <KingOfTheHillPage
        tournament={tournament}
        isCreator={isCreator}
        currentUserId={currentUserId}
        onBack={() => router.push('/dashboard/tournaments')}
      />
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
              {tournament.is_private && <Badge variant="secondary">Private</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {tournament.team_format === 'singles' ? 'Singles' : 'Doubles'}
              </Badge>
              <Badge variant="outline">
                {tournament.format === 'round_robin' && 'Round Robin'}
                {tournament.format === 'group_stage_playoffs' && 'Group Stage + Playoffs'}
                {tournament.format === 'king_of_the_hill' && 'King of the Hill'}
              </Badge>
              {tournament.format !== 'king_of_the_hill' && (
                <Badge variant="outline">{tournament.playoff_teams} playoff spots</Badge>
              )}
              {tournament.format === 'king_of_the_hill' && tournament.best_of > 1 && (
                <Badge variant="outline">Best of {tournament.best_of}</Badge>
              )}
            </div>
          </div>
          {(isCreator && isDeleteTournamentShow) && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 border-red-500 hover:bg-red-500/10"
              onClick={() => setShowDeleteTournament(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">{formatDate(tournament.date)}</div>
                  {tournament.start_time && (
                    <div className="text-muted-foreground">{formatTime(tournament.start_time)}</div>
                  )}
                </div>
              </div>
              {tournament.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">Location</div>
                    <div className="text-muted-foreground">{tournament.location}</div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">Teams</div>
                  <div className="text-muted-foreground">
                    {filledTeams.length} / {tournament.expected_teams}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">Playoff Teams</div>
                  <div className="text-muted-foreground">{tournament.playoff_teams}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t space-y-3">
              <div className="flex items-center justify-between">
                <Label>Share Tournament Link</Label>
                <Button variant="outline" size="sm" onClick={copyShareLink}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
              {isCreator && tournament.is_private && tournament.access_code && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Access Code</Label>
                    <p className="text-sm font-mono">{tournament.access_code}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyAccessCode}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>

            {tournament.is_dupr_required && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This tournament requires a DUPR account to participate.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${tournament.playoffs_started ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          {tournament.playoffs_started && (
            <TabsTrigger value="playoffs">
              <Trophy className="h-4 w-4 mr-1" />
              Playoffs
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="teams" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tournament Teams</CardTitle>
              <CardDescription>
                {filledTeams.length} of {tournament.expected_teams} teams fully registered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {teams.map((team) => (
                  <Card key={team.id} className={team.player1_name || team.player2_name ? 'bg-muted/30' : ''}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          {editingTeamName === team.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editedTeamName}
                                onChange={(e) => setEditedTeamName(e.target.value)}
                                placeholder={`Team ${team.team_number}`}
                                className="max-w-xs"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => updateTeamName(team.id, editedTeamName)}
                                disabled={!editedTeamName.trim()}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingTeamName(null);
                                  setEditedTeamName('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold">
                                {team.team_name || `Team ${team.team_number}`}
                              </div>
                              {isCreator && matches.length === 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingTeamName(team.id);
                                    setEditedTeamName(team.team_name || '');
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between border rounded-lg p-3">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">Player 1</div>
                          {editingPlayerSlot?.teamId === team.id && editingPlayerSlot?.slot === 'player1' ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input
                                value={editingPlayerName}
                                onChange={(e) => setEditingPlayerName(e.target.value)}
                                className="max-w-[180px]"
                                placeholder="Player name"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveTournamentPlayerName();
                                  if (e.key === 'Escape') {
                                    setEditingPlayerSlot(null);
                                    setEditingPlayerName('');
                                  }
                                }}
                              />
                              <Button size="sm" onClick={handleSaveTournamentPlayerName} disabled={!editingPlayerName.trim()}>
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingPlayerSlot(null);
                                  setEditingPlayerName('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : team.player1_name ? (
                            <div className="space-y-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium">{team.player1_name}</span>
                                {team.player1_rating && (
                                  <Badge variant="outline" className="text-xs">
                                    {team.player1_rating} DUPR
                                  </Badge>
                                )}
                              </div>
                              {team.player1_dupr_id && (
                                <div className="text-xs text-muted-foreground">
                                  DUPR ID: {team.player1_dupr_id}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Open Spot</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!team.player1_name && (!tournament?.is_dupr_required || !hasUserClaimedSpotInTournament(currentUserId)) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setClaimError('');
                                initiateClaimTeam(team, 'player1');
                              }}
                              disabled={!!(claimingSlot?.teamId === team.id && claimingSlot?.slot === 'player1')}
                            >
                              {claimingSlot?.teamId === team.id && claimingSlot?.slot === 'player1' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                              Claim
                            </Button>
                          )}
                          {team.player1_name && canEditTournamentPlayerName(team, 'player1') && !(editingPlayerSlot?.teamId === team.id && editingPlayerSlot?.slot === 'player1') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingPlayerSlot({ teamId: team.id, slot: 'player1' });
                                setEditingPlayerName(team.player1_name || '');
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canRemovePlayerFromTeam(team, 'player1') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openRemovePlayerFromTeamDialog(team, 'player1')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {!isSingles && (
                        <div className="flex items-center justify-between border rounded-lg p-3">
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground mb-1">Player 2</div>
                            {editingPlayerSlot?.teamId === team.id && editingPlayerSlot?.slot === 'player2' ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Input
                                  value={editingPlayerName}
                                  onChange={(e) => setEditingPlayerName(e.target.value)}
                                  className="max-w-[180px]"
                                  placeholder="Player name"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTournamentPlayerName();
                                    if (e.key === 'Escape') {
                                      setEditingPlayerSlot(null);
                                      setEditingPlayerName('');
                                    }
                                  }}
                                />
                                <Button size="sm" onClick={handleSaveTournamentPlayerName} disabled={!editingPlayerName.trim()}>
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingPlayerSlot(null);
                                    setEditingPlayerName('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : team.player2_name ? (
                              <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm font-medium">{team.player2_name}</span>
                                  {team.player2_rating && (
                                    <Badge variant="outline" className="text-xs">
                                      {team.player2_rating} DUPR
                                    </Badge>
                                  )}
                                </div>
                                {team.player2_dupr_id && (
                                  <div className="text-xs text-muted-foreground">
                                    DUPR ID: {team.player2_dupr_id}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Open Spot</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!team.player2_name && (!tournament?.is_dupr_required || !hasUserClaimedSpotInTournament(currentUserId)) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setClaimError('');
                                  initiateClaimTeam(team, 'player2');
                                }}
                                disabled={!!(claimingSlot?.teamId === team.id && claimingSlot?.slot === 'player2')}
                              >
                                {claimingSlot?.teamId === team.id && claimingSlot?.slot === 'player2' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                                Claim
                              </Button>
                            )}
                            {team.player2_name && canEditTournamentPlayerName(team, 'player2') && !(editingPlayerSlot?.teamId === team.id && editingPlayerSlot?.slot === 'player2') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingPlayerSlot({ teamId: team.id, slot: 'player2' });
                                  setEditingPlayerName(team.player2_name || '');
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canRemovePlayerFromTeam(team, 'player2') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openRemovePlayerFromTeamDialog(team, 'player2')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {team.claimed_by_user_id === currentUserId && (
                      <Badge variant="outline" className="text-green-600">
                        Your Team
                      </Badge>
                    )}
                  </div>

                  {claimError && selectedTeam?.id === team.id && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{claimError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {filledTeams.length >= 2 && matches.length === 0 && isCreator && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Generate Schedule</CardTitle>
            <CardDescription>
              All teams are registered. Create matches for the tournament.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={generateSchedule}
              disabled={generatingSchedule}
              className="w-full"
            >
              {generatingSchedule ? 'Generating...' : 'Create Tournament Schedule'}
            </Button>
          </CardContent>
        </Card>
      )}
    </TabsContent>

    <TabsContent value="schedule" className="mt-6">
      <div className="space-y-6">
        {matches.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Match Schedule</CardTitle>
              <CardDescription>Click on a match to enter scores</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const matchesByRound = matches.reduce((acc, match) => {
                  const round = match.round || 'Unassigned';
                  if (!acc[round]) acc[round] = [];
                  acc[round].push(match);
                  return acc;
                }, {} as Record<string, TournamentMatch[]>);

                const sortedRounds = Object.keys(matchesByRound).sort((a, b) => {
                  const numA = parseInt(a.replace(/\D/g, '')) || 0;
                  const numB = parseInt(b.replace(/\D/g, '')) || 0;
                  return numA - numB;
                });

                return (
                  <Tabs defaultValue={sortedRounds[0]} className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
                      {sortedRounds.map((round) => (
                        <TabsTrigger key={round} value={round} className="px-6">
                          {round}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {sortedRounds.map((round) => (
                      <TabsContent key={round} value={round} className="mt-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          {matchesByRound[round].map((match) => {
                            const gameScores = matchGameScores[match.id];
                            return (
                            <div
                              key={match.id}
                              className={`bg-card border rounded-lg overflow-hidden ${
                                match.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                              }`}
                            >
                              <div className="p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all" onClick={() => openScoreDialog(match)}>
                                <div className="flex justify-between items-start mb-2">
                                  {match.status === 'completed' && (
                                    <Badge className="bg-green-600 text-xs">Completed</Badge>
                                  )}
                                  {match.status === 'completed' && gameScores && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-6 -mt-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (expandedMatchId === match.id) {
                                          setExpandedMatchId(null);
                                        } else {
                                          setExpandedMatchId(match.id);
                                          if (!matchGameScores[match.id]) {
                                            getMatchGameScores(match.id).then(scores => {
                                              if (scores) {
                                                setMatchGameScores(prev => ({ ...prev, [match.id]: scores }));
                                              }
                                            });
                                          }
                                        }
                                      }}
                                    >
                                      {expandedMatchId === match.id ? 'Hide Details' : 'Show Details'}
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between p-3 rounded bg-muted/50">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-base font-medium truncate">
                                        {formatTeamPlayers(match.team1)}
                                      </div>
                                    </div>
                                    <div className="ml-3 w-14 h-12 border border-border rounded flex items-center justify-center bg-background">
                                      <span className="text-xl font-bold">
                                        {match.status === 'completed' ? match.team1_score : '-'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-center py-1">
                                    <span className="text-xs font-semibold text-muted-foreground">VS</span>
                                  </div>
                                  <div className="flex items-center justify-between p-3 rounded bg-muted/50">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-base font-medium truncate">
                                        {formatTeamPlayers(match.team2)}
                                      </div>
                                    </div>
                                    <div className="ml-3 w-14 h-12 border border-border rounded flex items-center justify-center bg-background">
                                      <span className="text-xl font-bold">
                                        {match.status === 'completed' ? match.team2_score : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {expandedMatchId === match.id && gameScores && (
                                <div className="border-t bg-muted/30 p-4">
                                  <div className="text-xs font-semibold text-muted-foreground mb-2">Game-by-Game Scores:</div>
                                  <div className="space-y-2">
                                    {gameScores.map((game, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Game {idx + 1}:</span>
                                        <div className="flex gap-3 items-center">
                                          <span className={`font-medium ${game.team1 > game.team2 ? 'text-green-600 font-bold' : ''}`}>
                                            {game.team1}
                                          </span>
                                          <span className="text-muted-foreground">-</span>
                                          <span className={`font-medium ${game.team2 > game.team1 ? 'text-green-600 font-bold' : ''}`}>
                                            {game.team2}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                          })}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                );
              })()}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No schedule generated yet. Generate a schedule from the Teams tab.
            </CardContent>
          </Card>
        )}

        {!tournament.playoffs_started && tournament?.format !=="round_robin" && matches.length > 0 && standings.length >= 2 && isCreator && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Start Playoffs
              </CardTitle>
              <CardDescription>
                End the regular season and advance the top {tournament.playoff_teams} teams to playoffs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={startPlayoffs}
                disabled={startingPlayoffs}
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                size="lg"
              >
                {startingPlayoffs ? 'Starting Playoffs...' : 'Start Playoffs'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </TabsContent>

    <TabsContent value="standings" className="mt-6">
      {matches.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
            <CardTitle>Standings</CardTitle>
            <CardDescription>Current tournament rankings</CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleShareStandings}
              disabled={standings.length === 0}
              className="gap-2"
            >
              {shareCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Share Standings
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {standings.length > 0 ? (
              <div className="space-y-2">
                {standings.map((standing, index) => (
                  <div key={standing.id} className={`flex items-center justify-between p-3 border rounded-lg ${tournament.champion_team_id === standing.team_id ? 'bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30' : ''
                  }`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="font-bold text-lg w-8">#{index + 1}</div>
                      {tournament.champion_team_id === standing.team_id && (
                        <Trophy className="h-5 w-5 text-primary fill-primary" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          {formatTeamPlayers(standing.team)}
                          {tournament.champion_team_id === standing.team_id && (
                            <Badge className="bg-gradient-to-r from-primary to-secondary text-white">Champion</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-6 text-sm flex-wrap">
                      <div className="text-center">
                        <div className="font-semibold">{standing.wins}-{standing.losses}</div>
                        <div className="text-xs text-muted-foreground">W-L</div>
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="font-semibold">{standing.points_for}</div>
                        <div className="text-xs text-muted-foreground">PF</div>
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="font-semibold">{standing.points_against}</div>
                        <div className="text-xs text-muted-foreground">PA</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-semibold ${standing.point_differential >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {standing.point_differential > 0 ? '+' : ''}{standing.point_differential}
                        </div>
                        <div className="text-xs text-muted-foreground">Diff</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No matches completed yet
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No standings available yet. Generate a schedule and complete matches first.
          </CardContent>
        </Card>
      )}
    </TabsContent>

    <TabsContent value="playoffs" className="mt-6">
      {playoffMatches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Playoff Bracket
            </CardTitle>
            <CardDescription>Knockout tournament - Top {tournament.playoff_teams} teams advancing</CardDescription>
          </CardHeader>
          <CardContent>
            <PlayoffBracket
              matches={playoffMatches}
              onMatchClick={openScoreDialog}
              isSingles={tournament.team_format === 'singles'}
            />

            {tournament.champion_team_id && (
              <div className="mt-8 p-6 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border-2 border-primary/30 rounded-xl text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-primary fill-primary" />
                <h3 className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                  Tournament Champion!
                </h3>
                <p className="text-lg font-semibold">
                  {teams.find(t => t.id === tournament.champion_team_id)?.team_name || 'Champion Team'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatTeamPlayersAmp(teams.find(t => t.id === tournament.champion_team_id))}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Playoffs have not started yet
          </CardContent>
        </Card>
      )}
    </TabsContent>
  </Tabs>

      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {selectedMatch?.status === 'completed' ? 'Edit Match Score' : 'Enter Match Score'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Enter game-by-game scores (0-30 points per game)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              {games.map((game, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-semibold text-sm">Game {idx + 1}</Label>
                    {idx >= 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newGames = [...games];
                          newGames.splice(idx, 1);
                          setGames(newGames);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {formatTeamPlayersAmp(selectedMatch?.team1)}
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={game.team1Points}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const newGames = [...games];
                          newGames[idx].team1Points = val;
                          setGames(newGames);
                        }}
                        placeholder="0"
                        className="h-12 text-xl text-center font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {formatTeamPlayersAmp(selectedMatch?.team2)}
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={game.team2Points}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const newGames = [...games];
                          newGames[idx].team2Points = val;
                          setGames(newGames);
                        }}
                        placeholder="0"
                        className="h-12 text-xl text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {games.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setGames([...games, { team1Points: '', team2Points: '' }]);
                  }}
                >
                  Add Game {games.length + 1}
                </Button>
              )}

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Games Won:</span>
                  <div className="flex gap-8">
                    <span className="font-bold">
                      {formatTeamPlayersAmp(selectedMatch?.team1)}: {
                        games.filter(g => {
                          const t1 = parseInt(g.team1Points);
                          const t2 = parseInt(g.team2Points);
                          return !isNaN(t1) && !isNaN(t2) && t1 > t2;
                        }).length
                      }
                    </span>
                    <span className="font-bold">
                      {formatTeamPlayersAmp(selectedMatch?.team2)}: {
                        games.filter(g => {
                          const t1 = parseInt(g.team1Points);
                          const t2 = parseInt(g.team2Points);
                          return !isNaN(t1) && !isNaN(t2) && t2 > t1;
                        }).length
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button variant="outline" onClick={() => setShowScoreDialog(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <div className="flex-1" />
              {isCreator && selectedMatch?.status === 'completed' && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Match
                </Button>
              )}
              <Button onClick={submitScore} className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary">
                Submit Score
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RemovePlayerConfirmDialog
        open={showRemovePlayerDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowRemovePlayerDialog(false);
            setPlayerToRemoveFromTeam(null);
          }
        }}
        description={
          playerToRemoveFromTeam
            ? `Are you sure you want to remove ${playerToRemoveFromTeam.slot === 'player1' ? playerToRemoveFromTeam.team.player1_name : playerToRemoveFromTeam.team.player2_name} from this team? The spot will be open for someone else to claim.`
            : ''
        }
        onConfirm={confirmRemovePlayerFromTeam}
        isLoading={removingPlayerFromTeam}
      />

      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Team Slot</DialogTitle>
            <DialogDescription>
              Enter your name to claim this spot on Team {selectedTeam?.team_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="claim-name">Player Name</Label>
              <Input
                id="claim-name"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
              />
            </div>
            {claimError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{claimError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowClaimDialog(false);
              setClaimName('');
              setClaimError('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmClaimTeam(claimName, null, null, selectedTeam, selectedSlot)}
              disabled={!claimName.trim()}
            >
              Claim Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open && !deleting) {
          setShowDeleteDialog(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Match</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this match? This will remove the scores and recalculate standings. {selectedMatch && (selectedMatch.dupr_match_id || selectedMatch.dupr_match_identifier) ? 'The match will also be deleted from DUPR.' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Match Details:</div>
                <div className="text-sm">
                  {formatTeamPlayersAmp(selectedMatch?.team1)} vs {formatTeamPlayersAmp(selectedMatch?.team2)}
                </div>
                {selectedMatch?.status === 'completed' && (
                  <div className="text-sm mt-1">
                    Score: {selectedMatch.team1_score} - {selectedMatch.team2_score}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMatch}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Match
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteTournament} onOpenChange={(open) => {
        if (!open && !deleting) {
          setShowDeleteTournament(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Match</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this Tournament?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteTournament(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTournament}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Tournament
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
