'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, MapPin, Users, Trophy, Copy, Check, CircleAlert as AlertCircle, UserPlus, CreditCard as Edit2, X, Pencil, Loader as Loader2, Trash2, CloudUpload, ChevronLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableRoundTabs, getEmptyGameCounts } from '@/components/scrollable-round-tabs';
import { ScrollableTabsList } from '@/components/scrollable-tabs-list';
import { TournamentTeamSettingsForm } from '@/components/tournament-team-settings-form';
import { PlayoffBracket } from '@/components/playoff-bracket';
import {
  buildReseededRoundMatches,
  findPendingReseedRound,
  getNextPlayoffRound,
  getReseedSurvivorIds,
  sortSurvivorsByOriginalSeed,
} from '@/lib/playoff-reseeding';
import { RemovePlayerConfirmDialog } from '@/components/remove-player-confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { getDisplayName } from '@/lib/utils';
import { KingOfTheHillPage } from './king-of-the-hill-page';
import { GameScoreInput } from '@/components/game-score-input';
import { copyToClipboard } from '@/lib/clipboard-utils';
import { sortTeamStandings } from '@/lib/standings-tiebreaker';
import {
  buildPlayoffsAndStandingsShareText,
  buildPlayoffsShareBlock,
  buildStandingsShareBlock,
  formatTournamentShareHeader,
  type PlayoffMatchShareRow,
  extractMatchGameScores,
} from '@/lib/tournament-share-text';
import {
  planGroupedRegularSeasonRebuild,
  planPlayoffFieldAfterRosterChange,
  planRegularSeasonRebuild,
} from '@/lib/schedule-rebuild';


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
  playoff_reseeding?: boolean;
  tiebreaker_point_differential_first?: boolean;
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
  groups_enabled?: boolean;
  number_of_groups?: number;
  teams_per_group_advancing?: number;
  registered_players_count?: number;
  dupr_club_id?: string | null;
  dupr_club_name?: string | null;
  dupr_plus_required_subs?: string[];
  pool_play_enabled?: boolean;
  teams_per_pool?: number | null;
  games_per_pool?: number | null;
  pool_advance_count?: number | null;
  pool_bye_count?: number | null;
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
  group_name?: string | null;
  group_position?: number | null;
  pool_name?: string | null;
  pool_position?: number | null;
  playoff_seed?: number | null;
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
  match_status?: 'pending' | 'in_progress' | 'completed';
  current_game?: number;
  is_score_confirmed?: boolean;
  score_submitted_by?: string | null;
  pool_name?: string | null;
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
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [scheduleView, setScheduleView] = useState<'rounds' | 'teams'>('rounds');
  const [selectedScheduleTeamId, setSelectedScheduleTeamId] = useState<string>('');
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [team1Score, setTeam1Score] = useState('');
  const [team2Score, setTeam2Score] = useState('');
  const [gameScores, setGameScores] = useState<Array<{ team1Points: string; team2Points: string }>>([]);
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
  const [sharePlayoffsCopied, setSharePlayoffsCopied] = useState(false);
  const [showRebuildDialog, setShowRebuildDialog] = useState(false);
  const [rebuildingSchedule, setRebuildingSchedule] = useState(false);
  const [addingTeamSlot, setAddingTeamSlot] = useState(false);
  const [rebuildPreview, setRebuildPreview] = useState<string | null>(null);
  const [syncingToDupr, setSyncingToDupr] = useState(false);
  const [localGameScores, setLocalGameScores] = useState<Record<number, { team1: string; team2: string }>>({});
  const [submittingScores, setSubmittingScores] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [canSyncToDupr, setCanSyncToDupr] = useState(false);
  const [confirmingScore, setConfirmingScore] = useState(false);
  const [reseedFromRound, setReseedFromRound] = useState<string | null>(null);
  const [generatingReseedRound, setGeneratingReseedRound] = useState(false);
  const [reseedDialogDismissedForRound, setReseedDialogDismissedForRound] = useState<string | null>(null);

  useEffect(() => {
    loadTournamentData();
  }, [params.id]);

  // Removed auto-switch to standings tab - let users stay on current tab after score submission

  const determineDefaultRound = (matchesByRound: Record<string, TournamentMatch[]>, sortedRounds: string[]): string => {
    if (sortedRounds.length === 0) return '';

    const hasAnyScore = (match: TournamentMatch) =>
      match.status === 'completed' ||
      match.game1_team1_points !== null ||
      match.game1_team2_points !== null ||
      match.game2_team1_points !== null ||
      match.game2_team2_points !== null ||
      match.game3_team1_points !== null ||
      match.game3_team2_points !== null ||
      match.game4_team1_points !== null ||
      match.game4_team2_points !== null ||
      match.game5_team1_points !== null ||
      match.game5_team2_points !== null;

    // Return the highest-numbered round that has at least one score entered.
    for (let i = sortedRounds.length - 1; i >= 0; i--) {
      const round = sortedRounds[i];
      if (matchesByRound[round].some(hasAnyScore)) {
        return round;
      }
    }

    // No scores at all — default to the first round.
    return sortedRounds[0];
  };


  const handleShareStandings = async () => {
    if (!tournament || standings.length === 0) {
      toast({
        title: "No standings",
        description: "No standings available to copy",
        variant: "destructive",
      });
      return;
    }

    try {
      const eventName = tournament.name?.trim() || "Tournament";

      // Format the date
      const dateStr = tournament.date ? new Date(tournament.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) : '';

      // Format only the start time
      const timeStr = tournament.start_time ? new Date(`2000-01-01T${tournament.start_time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) : '';

      // Count completed and total games (rounds × best_of)
      const nonPlayoffMatches = matches.filter(m => !m.is_playoff_match);
      const bestOf = tournament.best_of || 3;

      // Calculate total completed games across all matches
      let completedGamesCount = 0;
      nonPlayoffMatches.forEach(match => {
        if (match.status === 'completed') {
          // For completed matches, count actual games played
          const gamesPlayed = (match?.team1_games_won || 0) + (match.team2_games_won || 0);
          completedGamesCount += gamesPlayed;
        }
      });

      // Total possible games = total matches × best_of
      const totalPossibleGames = nonPlayoffMatches.length * bestOf;

      // Build header with tournament name, date, and time
      let text = `${eventName}\n`;
      if (dateStr) {
        text += `${dateStr}`;
        if (timeStr) {
          text += ` ${timeStr}`;
        }
        text += '\n';
      } else if (timeStr) {
        text += `${timeStr}\n`;
      }
      text += `\nStandings (${completedGamesCount}/${totalPossibleGames})\n\n`;

      // Add standings rows
      standings.forEach((s) => {
        const players = formatTeamPlayersAmp(s.team)?.trim();
        const playerName = players && players !== '—' ? players : (s.team?.team_name?.trim() || `Team ${s.team?.team_number ?? '?'}`);

        const w = s.wins ?? 0;
        const l = s.losses ?? 0;
        const diff = s.point_differential ?? 0;
        const diffStr = diff >= 0 ? `+${diff}` : diff.toString();

        text += `${playerName}    ${w}-${l} ${diffStr}\n`;
      });

      const result = await copyToClipboard(text.trim());

      if (result.success) {
        setShareCopied(true);
        toast({
          title: "Standings copied",
          description: "Team standings ready to paste",
        });
        setTimeout(() => setShareCopied(false), 2200);
      } else {
        toast({
          title: "Failed to copy",
          description: result.error || "Could not copy standings to clipboard",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in handleShareStandings:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while copying standings",
        variant: "destructive",
      });
    }
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

      if (tournamentData.dupr_club_id) {
        try {
          const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-user-clubs`;
          const resp = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            const clubs: Array<{ id: string; name: string; role?: string }> = data.clubs ?? [];
            const matchingClub = clubs.find(c => c.id === tournamentData.dupr_club_id);
            const role = matchingClub?.role?.toLowerCase() ?? '';
            setCanSyncToDupr(role === 'admin' || role === 'director' || role === 'organizer');
          } else {
            setCanSyncToDupr(false);
          }
        } catch {
          setCanSyncToDupr(false);
        }
      } else {
        setCanSyncToDupr(false);
      }

      const { data: teamsData } = await supabase
        .from('tournament_teams')
        .select('*')
        .eq('tournament_id', params.id)
        .order('team_number', { ascending: true });

      setTeams(teamsData || []);

      const matchesData = await loadMatches();
      await loadStandings(teamsData || [], matchesData);
    } catch (error) {
      console.error('Error loading tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTournament = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', params.id)
        .single();

      if (tournamentError) throw tournamentError;

      setTournament(tournamentData);
    } catch (error) {
      console.error('Error refreshing tournament:', error);
    }
  };

  const loadTeams = async () => {
    const { data: teamsData } = await supabase
      .from('tournament_teams')
      .select('*')
      .eq('tournament_id', params.id)
      .order('team_number', { ascending: true });

    if (teamsData) {
      setTeams(teamsData);
    }
  };

  const loadMatches = async (): Promise<TournamentMatch[]> => {
    const { data: matchesData } = await supabase
      .from('tournament_matches')
      .select('*, team1:tournament_teams!team1_id(*), team2:tournament_teams!team2_id(*)')
      .eq('tournament_id', params.id)
      .eq('is_playoff_match', false)
      .is('deleted_at', null)
      .order('match_number', { ascending: true });

    if (matchesData) {
      setMatches(matchesData as any);
      setSelectedRound(prev => {
        if (prev) return prev;
        const byRound = (matchesData as any[]).reduce((acc: Record<string, any[]>, m: any) => {
          const r = m.round || 'Unassigned';
          if (!acc[r]) acc[r] = [];
          acc[r].push(m);
          return acc;
        }, {});
        const sorted = Object.keys(byRound).sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.replace(/\D/g, '')) || 0;
          return numA - numB;
        });
        return determineDefaultRound(byRound, sorted);
      });
    }

    const { count } = await supabase
      .from('tournament_matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', params.id)
      .eq('is_playoff_match', false);

    setIsDeleteTournamentShow(count === 0);

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

    return (matchesData as TournamentMatch[]) || [];
  };

  const loadStandings = async (allTeams?: TournamentTeam[], matchesForTiebreaker?: TournamentMatch[]) => {
    const { data: standingsData } = await supabase
      .from('team_standings')
      .select('*, team:tournament_teams(*)')
      .eq('tournament_id', params.id)
      .order('wins', { ascending: false })
      .order('point_differential', { ascending: false });

    const fetched: TeamStanding[] = (standingsData as any) || [];
    const teamList = allTeams ?? teams;
    const standingTeamIds = new Set(fetched.map(s => s.team_id));
    const zeroEntries: TeamStanding[] = teamList
      .filter(t => !standingTeamIds.has(t.id))
      .map(t => ({
        id: `zero-${t.id}`,
        tournament_id: params.id,
        team_id: t.id,
        matches_played: 0,
        wins: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        point_differential: 0,
        team: t,
      }));
    const merged = [...fetched, ...zeroEntries];
    const regularSeasonMatches = matchesForTiebreaker ?? matches.filter((match) => !match.is_playoff_match);
    const pointDiffFirst = tournament?.tiebreaker_point_differential_first ?? false;
    setStandings(sortTeamStandings(merged, regularSeasonMatches, pointDiffFirst));
  };

  const sortStandingsForTiebreaker = (items: TeamStanding[], matchesForTiebreaker?: TournamentMatch[]) => {
    const regularSeasonMatches = matchesForTiebreaker ?? matches.filter((match) => !match.is_playoff_match);
    const pointDiffFirst = tournament?.tiebreaker_point_differential_first ?? false;
    return sortTeamStandings(items, regularSeasonMatches, pointDiffFirst);
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
  const isRoundRobinIndividual = tournament?.format === 'round_robin_individual';
  const isTeamFilled = (t: TournamentTeam) => {
    // For Round Robin Individual, each registration is a single player regardless of singles/doubles
    if (isRoundRobinIndividual) {
      return !!t.player1_name;
    }
    // For traditional team formats, check based on singles/doubles
    return isSingles ? !!t.player1_name : !!(t.player1_name && t.player2_name);
  };

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

      // Pool play — assign teams to pools then generate limited intra-pool schedule
      if (tournament.pool_play_enabled && tournament.teams_per_pool && tournament.games_per_pool) {
        const { assignTeamsToPools } = await import('@/lib/group-helpers');
        const assignments = assignTeamsToPools(filledTeams.length, tournament.teams_per_pool);

        // Write pool assignments back to tournament_teams
        for (let i = 0; i < filledTeams.length; i++) {
          await supabase
            .from('tournament_teams')
            .update({
              pool_name: assignments[i].poolName,
              pool_position: assignments[i].poolPosition,
            })
            .eq('id', filledTeams[i].id);
        }

        // Reload teams so we have fresh pool assignments
        await loadTeams();

        // Build pool → team index map
        const { generatePoolPlayPairings } = await import('@/lib/schedule-generator');
        const teamsByPool = new Map<string, number[]>();
        filledTeams.forEach((team, index) => {
          const pool = assignments[index].poolName;
          if (!teamsByPool.has(pool)) teamsByPool.set(pool, []);
          teamsByPool.get(pool)!.push(index);
        });

        const pairings = generatePoolPlayPairings(teamsByPool, tournament.games_per_pool);

        const matchesToCreate = pairings.map((pairing, index) => ({
          tournament_id: tournament.id,
          match_number: index + 1,
          round: `Round ${pairing.roundNumber}`,
          pool_name: pairing.poolName,
          team1_id: filledTeams[pairing.participant1Index].id,
          team2_id: filledTeams[pairing.participant2Index].id,
          player1_id: filledTeams[pairing.participant1Index].player1_user_id || null,
          player2_id: filledTeams[pairing.participant1Index].player2_user_id || null,
          player3_id: filledTeams[pairing.participant2Index].player1_user_id || null,
          player4_id: filledTeams[pairing.participant2Index].player2_user_id || null,
          status: 'scheduled',
          is_playoff_match: false,
        }));

        const { error } = await supabase.from('tournament_matches').insert(matchesToCreate);
        if (error) throw error;

      } else if (tournament.groups_enabled && tournament.number_of_groups) {
        // Assign teams to groups if not already assigned
        const teamsNeedingGroups = filledTeams.filter(t => !t.group_name);
        if (teamsNeedingGroups.length > 0) {
          const { assignTeamsToGroups } = await import('@/lib/group-helpers');
          const assignments = assignTeamsToGroups(filledTeams.length, tournament.number_of_groups);

          // Update teams with group assignments
          for (let i = 0; i < filledTeams.length; i++) {
            const team = filledTeams[i];
            const assignment = assignments[i];
            await supabase
              .from('tournament_teams')
              .update({
                group_name: assignment.groupName,
                group_position: assignment.groupPosition,
              })
              .eq('id', team.id);
          }

          // Reload teams to get updated group assignments
          await loadTeams();
        }

        // Generate group stage matches
        const { generateGroupStagePairings } = await import('@/lib/schedule-generator');
        const teamsByGroup = new Map<string, number[]>();

        filledTeams.forEach((team, index) => {
          const groupName = team.group_name || 'A';
          if (!teamsByGroup.has(groupName)) {
            teamsByGroup.set(groupName, []);
          }
          teamsByGroup.get(groupName)!.push(index);
        });

        const pairings = generateGroupStagePairings(teamsByGroup);

        // Convert pairings to tournament matches
        const matchesToCreate = pairings.map((pairing, index) => ({
          tournament_id: tournament.id,
          match_number: index + 1,
          round: `Round ${pairing.roundNumber}`,
          group_name: pairing.groupName,
          team1_id: filledTeams[pairing.participant1Index].id,
          team2_id: filledTeams[pairing.participant2Index].id,
          player1_id: filledTeams[pairing.participant1Index].player1_user_id || null,
          player2_id: filledTeams[pairing.participant1Index].player2_user_id || null,
          player3_id: filledTeams[pairing.participant2Index].player1_user_id || null,
          player4_id: filledTeams[pairing.participant2Index].player2_user_id || null,
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
      } else {
        // Tournament round-robin (no groups) — each team plays exactly once per round
        const { generateTournamentRoundPairings } = await import('@/lib/schedule-generator');
        const pairings = generateTournamentRoundPairings(filledTeams.length);

        // Convert pairings to tournament matches
        const matchesToCreate = pairings.map((pairing, index) => ({
          tournament_id: tournament.id,
          match_number: index + 1,
          round: `Round ${pairing.roundNumber}`,
          team1_id: filledTeams[pairing.participant1Index].id,
          team2_id: filledTeams[pairing.participant2Index].id,
          player1_id: filledTeams[pairing.participant1Index].player1_user_id || null,
          player2_id: filledTeams[pairing.participant1Index].player2_user_id || null,
          player3_id: filledTeams[pairing.participant2Index].player1_user_id || null,
          player4_id: filledTeams[pairing.participant2Index].player2_user_id || null,
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

  const buildRegularRebuildPlan = () => {
    const filled = teams.filter(isTeamFilled);
    const filledCheck = (t: { player1_name?: string | null; player2_name?: string | null }) =>
      isTeamFilled(t as TournamentTeam);
    if (tournament?.pool_play_enabled) {
      return planGroupedRegularSeasonRebuild(filled, matches, 'pool', { isTeamFilled: filledCheck });
    }
    if (tournament?.groups_enabled) {
      return planGroupedRegularSeasonRebuild(filled, matches, 'group', { isTeamFilled: filledCheck });
    }
    return planRegularSeasonRebuild(filled, matches, { isTeamFilled: filledCheck });
  };

  const openRebuildDialog = () => {
    if (!tournament) return;
    const filled = teams.filter(isTeamFilled);
    if (filled.length < 2) {
      toast({
        title: 'Need more teams',
        description: 'At least 2 complete teams are required to rebuild the schedule.',
        variant: 'destructive',
      });
      return;
    }
    const plan = buildRegularRebuildPlan();
    let preview = plan.summary;
    if (tournament.playoffs_started && playoffMatches.length > 0) {
      const playoffPlan = planPlayoffFieldAfterRosterChange(
        filled.map((t) => t.id),
        playoffMatches,
      );
      preview += `\n\nPlayoffs: ${playoffPlan.summary}`;
    }
    setRebuildPreview(preview);
    setShowRebuildDialog(true);
  };

  const addTeamSlot = async () => {
    if (!tournament || !isCreator) return;
    setAddingTeamSlot(true);
    try {
      const nextNumber =
        teams.reduce((max, t) => Math.max(max, t.team_number || 0), 0) + 1;
      const { error: insertError } = await supabase.from('tournament_teams').insert({
        tournament_id: tournament.id,
        team_number: nextNumber,
      });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ expected_teams: Math.max(tournament.expected_teams || 0, nextNumber) })
        .eq('id', tournament.id);
      if (updateError) throw updateError;

      await refreshTournament();
      await loadTeams();
      toast({
        title: 'Team slot added',
        description:
          matches.length > 0
            ? 'Fill the new team, then use Rebuild Schedule to realign remaining rounds.'
            : 'New empty team slot is ready to claim.',
      });
    } catch (error: any) {
      console.error('Error adding team slot:', error);
      toast({
        title: 'Failed to add team',
        description: error.message || 'Could not add a team slot.',
        variant: 'destructive',
      });
    } finally {
      setAddingTeamSlot(false);
    }
  };

  const rebuildScheduleFromRoster = async () => {
    if (!tournament || !isCreator) return;
    setRebuildingSchedule(true);
    try {
      const filled = teams.filter(isTeamFilled);
      if (filled.length < 2) {
        throw new Error('Need at least 2 complete teams');
      }

      const plan = buildRegularRebuildPlan();

      if (plan.matchIdsToSoftDelete.length > 0) {
        const { error: softDeleteError } = await supabase
          .from('tournament_matches')
          .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId })
          .in('id', plan.matchIdsToSoftDelete);
        if (softDeleteError) throw softDeleteError;
      }

      const teamById = new Map(filled.map((t) => [t.id, t]));
      const matchesToCreate = plan.matchesToInsert.map((m, index) => {
        const t1 = teamById.get(m.team1Id)!;
        const t2 = teamById.get(m.team2Id)!;
        return {
          tournament_id: tournament.id,
          match_number: 5000 + index + 1,
          round: m.round,
          group_name: m.groupName || null,
          pool_name: m.poolName || null,
          team1_id: m.team1Id,
          team2_id: m.team2Id,
          player1_id: t1.player1_user_id || null,
          player2_id: t1.player2_user_id || null,
          player3_id: t2.player1_user_id || null,
          player4_id: t2.player2_user_id || null,
          status: 'scheduled',
          is_playoff_match: false,
        };
      });

      if (matchesToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('tournament_matches')
          .insert(matchesToCreate);
        if (insertError) throw insertError;
      }

      // Realign unfinished playoffs when already started
      if (tournament.playoffs_started) {
        const playoffPlan = planPlayoffFieldAfterRosterChange(
          filled.map((t) => t.id),
          playoffMatches,
        );

        if (playoffPlan.matchIdsToSoftDelete.length > 0) {
          const { error: playoffDeleteError } = await supabase
            .from('tournament_matches')
            .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId })
            .in('id', playoffPlan.matchIdsToSoftDelete);
          if (playoffDeleteError) throw playoffDeleteError;
        }

        const fieldIds = [...playoffPlan.survivorIds, ...playoffPlan.lateEntrantIds];
        if (fieldIds.length >= 2) {
          // Seed: previous survivors keep relative order from standings; late entrants last (missed round = bye)
          const orderedField = [
            ...playoffPlan.survivorIds,
            ...playoffPlan.lateEntrantIds,
          ];

          await Promise.all(
            orderedField.map((teamId, index) =>
              supabase
                .from('tournament_teams')
                .update({ playoff_seed: index + 1 })
                .eq('id', teamId),
            ),
          );

          const roundNames: Record<number, string> = {
            2: 'Finals',
            4: 'Semifinals',
            8: 'Quarterfinals',
            16: 'Round of 16',
            32: 'Round of 32',
          };
          const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(orderedField.length)));
          const byeCount = nextPowerOf2 - orderedField.length;
          // Late entrants already "used" their bye for missed round — remaining byes go to top seeds only
          const effectiveByes = Math.max(0, byeCount);
          const playingCount = orderedField.length - effectiveByes;
          const roundName = roundNames[nextPowerOf2] || `Round of ${nextPowerOf2}`;

          const playoffInserts: any[] = [];
          let bracketPosition = 1;

          if (effectiveByes > 0 && playingCount >= 2) {
            const earlyRoundName = roundNames[nextPowerOf2] || `Round of ${nextPowerOf2}`;
            const byeRoundName =
              roundNames[nextPowerOf2 / 2] || `Round of ${nextPowerOf2 / 2}`;
            const byeTeams = orderedField.slice(0, effectiveByes);
            const playingTeams = orderedField.slice(effectiveByes);
            const halfLen = Math.floor(playingTeams.length / 2);

            for (let i = 0; i < halfLen; i++) {
              const high = playingTeams[i];
              const low = playingTeams[playingTeams.length - 1 - i];
              const bp = effectiveByes + i + 1;
              playoffInserts.push({
                tournament_id: tournament.id,
                match_number: 3000 + bracketPosition,
                round: earlyRoundName,
                team1_id: high,
                team2_id: low,
                seeding_position_team1: effectiveByes + i + 1,
                seeding_position_team2: orderedField.length - i,
                status: 'scheduled',
                is_playoff_match: true,
                playoff_round: earlyRoundName,
                bracket_position: bp,
              });
              bracketPosition++;
            }

            for (let i = 0; i < byeTeams.length; i++) {
              playoffInserts.push({
                tournament_id: tournament.id,
                match_number: 4000 + i + 1,
                round: byeRoundName,
                team1_id: byeTeams[i],
                team2_id: null,
                seeding_position_team1: i + 1,
                seeding_position_team2: null,
                status: 'scheduled',
                is_playoff_match: true,
                playoff_round: byeRoundName,
                bracket_position: i + 1,
              });
            }
          } else {
            const halfLen = Math.floor(orderedField.length / 2);
            for (let i = 0; i < halfLen; i++) {
              const high = orderedField[i];
              const low = orderedField[orderedField.length - 1 - i];
              playoffInserts.push({
                tournament_id: tournament.id,
                match_number: 3000 + bracketPosition,
                round: roundName,
                team1_id: high,
                team2_id: low,
                seeding_position_team1: i + 1,
                seeding_position_team2: orderedField.length - i,
                status: 'scheduled',
                is_playoff_match: true,
                playoff_round: roundName,
                bracket_position: bracketPosition,
              });
              bracketPosition++;
            }
          }

          if (playoffInserts.length > 0) {
            const { error: playoffInsertError } = await supabase
              .from('tournament_matches')
              .insert(playoffInserts);
            if (playoffInsertError) throw playoffInsertError;
          }

          await supabase
            .from('tournaments')
            .update({ playoff_teams: orderedField.length, playoff_byes: effectiveByes })
            .eq('id', tournament.id);
        }
      }

      await loadTeams();
      await loadMatches();
      await refreshTournament();
      setShowRebuildDialog(false);
      setActiveTab('schedule');
      toast({
        title: 'Schedule rebuilt',
        description: plan.summary,
      });
    } catch (error: any) {
      console.error('Error rebuilding schedule:', error);
      toast({
        title: 'Rebuild failed',
        description: error.message || 'Could not rebuild the schedule.',
        variant: 'destructive',
      });
    } finally {
      setRebuildingSchedule(false);
    }
  };

  const isParticipantInMatch = (match: TournamentMatch): boolean => {
    if (!currentUserId) return false;
    const t1 = match?.team1;
    const t2 = match?.team2;
    return (
      t1?.player1_user_id === currentUserId ||
      t1?.player2_user_id === currentUserId ||
      t2?.player1_user_id === currentUserId ||
      t2?.player2_user_id === currentUserId
    );
  };

  const canUserEnterScore = (match: TournamentMatch): boolean => {
    if (!currentUserId) return false;
    return isCreator || canSyncToDupr || isParticipantInMatch(match);
  };

  const canUserConfirmScore = (): boolean => {
    return isCreator || canSyncToDupr;
  };

  const confirmMatchScore = async (match: TournamentMatch) => {
    if (!canUserConfirmScore()) return;
    try {
      setConfirmingScore(true);
      const { error } = await supabase
        .from('tournament_matches')
        .update({ is_score_confirmed: true })
        .eq('id', match.id);
      if (error) throw error;
      await loadMatches();
      setSelectedMatch(prev => prev?.id === match.id ? { ...prev, is_score_confirmed: true } : prev);
      toast({ title: 'Scores Confirmed', description: 'Match scores have been confirmed.', variant: 'default' });
    } catch (error) {
      console.error('Error confirming scores:', error);
      toast({ title: 'Error', description: 'Failed to confirm scores. Please try again.', variant: 'destructive' });
    } finally {
      setConfirmingScore(false);
    }
  };

  const openScoreDialog = (match: TournamentMatch) => {
    if (!canUserEnterScore(match)) {
      toast({
        title: 'Access denied',
        description: 'Only the tournament creator, DUPR club director/organizer, or a player in this match can enter scores.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedMatch(match);

    const initialScores: Record<number, { team1: string; team2: string }> = {};
    for (let i = 1; i <= (tournament?.best_of || 3); i++) {
      const t1 = match[`game${i}_team1_points` as keyof TournamentMatch] as number | null;
      const t2 = match[`game${i}_team2_points` as keyof TournamentMatch] as number | null;
      initialScores[i] = {
        team1: t1 !== null ? t1.toString() : '',
        team2: t2 !== null ? t2.toString() : ''
      };
    }
    setLocalGameScores(initialScores);
    setShowScoreDialog(true);
  };

  const handleScoreChange = (gameNumber: number, team1Points: string, team2Points: string) => {
    setLocalGameScores(prev => ({
      ...prev,
      [gameNumber]: { team1: team1Points, team2: team2Points }
    }));
  };

  const submitAllScores = async () => {
    if (!selectedMatch || !tournament) return;

    try {
      setSubmittingScores(true);

      const gamesToSubmit: Array<{ gameNum: number; team1: number; team2: number }> = [];
      const bestOf = tournament.best_of || 3;

      for (let i = 1; i <= bestOf; i++) {
        const score = localGameScores[i];
        if (!score) continue;

        const team1Raw = score.team1.trim();
        const team2Raw = score.team2.trim();

        // Skip games with no scores entered — leave them as dashes
        if (team1Raw === '' && team2Raw === '') {
          continue;
        }

        // If only one side is entered, treat the empty side as 0
        const t1 = team1Raw === '' ? 0 : parseInt(team1Raw, 10);
        const t2 = team2Raw === '' ? 0 : parseInt(team2Raw, 10);

        if (isNaN(t1) || isNaN(t2) || t1 < 0 || t2 < 0) {
          toast({
            title: 'Invalid score',
            description: `Game ${i} has invalid scores. Please enter valid numbers.`,
            variant: 'destructive'
          });
          return;
        }

        if (t1 === t2) {
          toast({
            title: 'Invalid score',
            description: `Game ${i} cannot be tied.`,
            variant: 'destructive'
          });
          return;
        }

        gamesToSubmit.push({ gameNum: i, team1: t1, team2: t2 });
      }

      if (gamesToSubmit.length === 0) {
        toast({
          title: 'No scores to submit',
          description: 'Please enter scores for at least one game.',
          variant: 'destructive'
        });
        return;
      }

      const { data: currentMatch, error: fetchError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('id', selectedMatch.id)
        .single();

      if (fetchError) throw fetchError;

      const updateData: any = {};

      for (const game of gamesToSubmit) {
        updateData[`game${game.gameNum}_team1_points`] = game.team1;
        updateData[`game${game.gameNum}_team2_points`] = game.team2;
      }

      let team1GamesWon = 0;
      let team2GamesWon = 0;
      let team1TotalPoints = 0;
      let team2TotalPoints = 0;

      for (let i = 1; i <= bestOf; i++) {
        let t1Points = currentMatch[`game${i}_team1_points`];
        let t2Points = currentMatch[`game${i}_team2_points`];

        const submittedGame = gamesToSubmit.find(g => g.gameNum === i);
        if (submittedGame) {
          t1Points = submittedGame.team1;
          t2Points = submittedGame.team2;
        }

        if (t1Points !== null && t2Points !== null) {
          team1TotalPoints += t1Points;
          team2TotalPoints += t2Points;
          if (t1Points > t2Points) team1GamesWon++;
          else if (t2Points > t1Points) team2GamesWon++;
        }
      }

      updateData.team1_score = team1TotalPoints;
      updateData.team2_score = team2TotalPoints;
      updateData.team1_games_won = team1GamesWon;
      updateData.team2_games_won = team2GamesWon;
      updateData.is_score_confirmed = false;
      updateData.score_submitted_by = currentUserId;

      const gamesToWin = Math.ceil(bestOf / 2);
      const matchDecided = team1GamesWon >= gamesToWin || team2GamesWon >= gamesToWin;

      if (matchDecided) {
        updateData.match_status = 'completed';
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      } else if (team1GamesWon > 0 || team2GamesWon > 0) {
        updateData.match_status = 'in_progress';
        updateData.status = 'in_progress';
      }

      const maxGame = Math.max(...gamesToSubmit.map(g => g.gameNum));
      updateData.current_game = Math.max(maxGame, currentMatch.current_game || 0);

      const { error } = await supabase
        .from('tournament_matches')
        .update(updateData)
        .eq('id', selectedMatch.id);

      if (error) throw error;

      const { data: updatedMatch } = await supabase
        .from('tournament_matches')
        .select('winner_team_id')
        .eq('id', selectedMatch.id)
        .single();

      if (matchDecided && selectedMatch.is_playoff_match && updatedMatch?.winner_team_id) {
        if (selectedMatch.playoff_round === 'Finals') {
          await supabase
            .from('tournaments')
            .update({ champion_team_id: updatedMatch.winner_team_id })
            .eq('id', tournament.id);
        } else {
          await advancePlayoffBracket(selectedMatch, updatedMatch.winner_team_id);
        }
      }

      const matchesData = await loadMatches();
      await loadStandings(undefined, matchesData);
      await loadTournamentData();

      toast({
        title: matchDecided ? 'Match Complete!' : 'Scores Saved',
        description: matchDecided
          ? `${team1GamesWon > team2GamesWon ? formatTeamPlayersAmp(selectedMatch.team1) : formatTeamPlayersAmp(selectedMatch.team2)} wins ${Math.max(team1GamesWon, team2GamesWon)}-${Math.min(team1GamesWon, team2GamesWon)}`
          : `${gamesToSubmit.length} game${gamesToSubmit.length > 1 ? 's' : ''} recorded. Series: ${team1GamesWon}-${team2GamesWon}`,
        variant: 'default'
      });

      // Close dialog on successful submission
      setShowScoreDialog(false);

      if (matchDecided && !selectedMatch.is_playoff_match) {
        await checkAndAutoStartPlayoffs();
      }
    } catch (error) {
      console.error('Error submitting scores:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit scores. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmittingScores(false);
    }
  };

  const checkAndAutoStartPlayoffs = async () => {
    if (!tournament) return;
    if (tournament.playoffs_started) return;
    if (!tournament.has_playoffs) return;
    const { data: remaining } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('is_playoff_match', false)
      .is('deleted_at', null)
      .neq('status', 'completed')
      .limit(1);

    if (!remaining || remaining.length > 0) return;

    toast({
      title: 'All matches complete!',
      description: 'Starting playoffs automatically...',
    });

    await startPlayoffs();
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
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${freshSession?.access_token}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              matchId: result.match_id,
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
      const matchesData = await loadMatches();
      await loadStandings(undefined, matchesData);
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

  const submitGameScore = async (gameNumber: number, team1Points: number, team2Points: number) => {
    if (!selectedMatch || !tournament) return;

    try {
      // First, get the current match state
      const { data: currentMatch, error: fetchError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('id', selectedMatch.id)
        .single();

      if (fetchError) throw fetchError;

      // Prepare update data
      const updateData: any = {
        [`game${gameNumber}_team1_points`]: team1Points,
        [`game${gameNumber}_team2_points`]: team2Points,
        current_game: Math.max(gameNumber, currentMatch.current_game || 0),
      };

      // Calculate games won for each team
      let team1GamesWon = 0;
      let team2GamesWon = 0;
      let team1TotalPoints = 0;
      let team2TotalPoints = 0;

      for (let i = 1; i <= 5; i++) {
        let t1Points = currentMatch[`game${i}_team1_points`];
        let t2Points = currentMatch[`game${i}_team2_points`];

        // Override with new scores if this is the game being updated
        if (i === gameNumber) {
          t1Points = team1Points;
          t2Points = team2Points;
        }

        if (t1Points !== null && t2Points !== null) {
          team1TotalPoints += t1Points;
          team2TotalPoints += t2Points;
          if (t1Points > t2Points) team1GamesWon++;
          else if (t2Points > t1Points) team2GamesWon++;
        }
      }

      // Update scores
      updateData.team1_score = team1TotalPoints;
      updateData.team2_score = team2TotalPoints;
      updateData.team1_games_won = team1GamesWon;
      updateData.team2_games_won = team2GamesWon;

      // Determine match status
      const gamesToWin = Math.ceil(tournament.best_of / 2);
      const matchDecided = team1GamesWon >= gamesToWin || team2GamesWon >= gamesToWin;

      if (matchDecided) {
        updateData.match_status = 'completed';
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      } else if (team1GamesWon > 0 || team2GamesWon > 0) {
        updateData.match_status = 'in_progress';
        updateData.status = 'in_progress';
      }

      // Update the match
      const { error } = await supabase
        .from('tournament_matches')
        .update(updateData)
        .eq('id', selectedMatch.id);

      if (error) throw error;

      // Get updated match with winner
      const { data: updatedMatch } = await supabase
        .from('tournament_matches')
        .select('winner_team_id')
        .eq('id', selectedMatch.id)
        .single();

      if (matchDecided && selectedMatch.is_playoff_match && updatedMatch?.winner_team_id) {
        if (selectedMatch.playoff_round === 'Finals') {
          await supabase
            .from('tournaments')
            .update({ champion_team_id: updatedMatch.winner_team_id })
            .eq('id', tournament.id);
        } else {
          await advancePlayoffBracket(selectedMatch, updatedMatch.winner_team_id);
        }
      }

      // Reload data
      const matchesData = await loadMatches();
      await loadStandings(undefined, matchesData);
      await loadTournamentData();

      toast({
        title: matchDecided ? 'Match Complete!' : 'Game Score Saved',
        description: matchDecided
          ? `${team1GamesWon > team2GamesWon ? formatTeamPlayersAmp(selectedMatch.team1) : formatTeamPlayersAmp(selectedMatch.team2)} wins ${Math.max(team1GamesWon, team2GamesWon)}-${Math.min(team1GamesWon, team2GamesWon)}`
          : `Game ${gameNumber} recorded. Series: ${team1GamesWon}-${team2GamesWon}`,
        variant: 'default'
      });

      // Close dialog if match is complete
      if (matchDecided) {
        setShowScoreDialog(false);
        if (!selectedMatch.is_playoff_match) {
          await checkAndAutoStartPlayoffs();
        }
      }
    } catch (error) {
      console.error('Error submitting game score:', error);
      throw error;
    }
  };

  const syncToDupr = async () => {
    if (!tournament) return;

    try {
      setSyncingToDupr(true);

      const hasScore = (m: TournamentMatch) => {
        const hasGameScore =
          m.game1_team1_points != null ||
          m.game2_team1_points != null ||
          m.game3_team1_points != null ||
          m.game4_team1_points != null ||
          m.game5_team1_points != null;
        const hasTraditionalScore = (m.team1_score != null && m.team2_score != null && (m.team1_score > 0 || m.team2_score > 0));
        return hasGameScore || hasTraditionalScore;
      };

      const completedMatches = [
        ...matches.filter(m => hasScore(m)),
        ...playoffMatches.filter(m => hasScore(m)),
      ];

      if (completedMatches.length === 0) {
        toast({
          title: 'No matches to sync',
          description: 'There are no completed matches to sync to DUPR.',
          variant: 'default'
        });
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-create-club-match`;
      const { data: { session: authSession } } = await supabase.auth.getSession();

      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const match of completedMatches) {
        try {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authSession?.access_token}`,
            },
            body: JSON.stringify({ matchId: match.id }),
          });

          const data = await res.json().catch(() => ({}));

          if (data.synced) {
            syncedCount++;
            await supabase
              .from('tournament_matches')
              .update({ is_score_confirmed: true })
              .eq('id', match.id);
          } else if (data.reason && res.ok) {
            skippedCount++;
          } else if (!res.ok) {
            errorCount++;
          }
        } catch (matchErr) {
          console.error(`Error syncing match ${match.id}:`, matchErr);
          errorCount++;
        }
      }

      if (syncedCount > 0) {
        await loadMatches();
        toast({
          title: 'Synced to DUPR',
          description: `Successfully synced ${syncedCount} match${syncedCount > 1 ? 'es' : ''} to DUPR. Scores confirmed.${skippedCount > 0 ? ` ${skippedCount} skipped (no club or missing DUPR IDs).` : ''}${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
          variant: 'default'
        });
      } else if (skippedCount > 0 && errorCount === 0) {
        toast({
          title: 'Cannot sync to DUPR',
          description: 'Matches require a DUPR club and all players must have DUPR IDs.',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Sync failed',
          description: 'Failed to sync matches to DUPR. Please try again.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error syncing to DUPR:', error);
      toast({
        title: 'Sync failed',
        description: 'An error occurred while syncing to DUPR.',
        variant: 'destructive'
      });
    } finally {
      setSyncingToDupr(false);
    }
  };

  const generateReseededRound = async (fromRound: string) => {
    if (!tournament) return;

    const orderedTeamIds = sortSurvivorsByOriginalSeed(
      getReseedSurvivorIds(playoffMatches, fromRound),
      teams
    );

    try {
      setGeneratingReseedRound(true);
      const nextRound = getNextPlayoffRound(fromRound);
      if (!nextRound) return;

      const { data: maxMatch } = await supabase
        .from('tournament_matches')
        .select('match_number')
        .eq('tournament_id', tournament.id)
        .order('match_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const payloads = buildReseededRoundMatches(
        tournament.id,
        orderedTeamIds,
        nextRound,
        (maxMatch?.match_number ?? 1000) + 1
      );

      if (payloads.length === 0) return;

      const { error } = await supabase.from('tournament_matches').insert(payloads);
      if (error) throw error;

      setReseedFromRound(null);
      setReseedDialogDismissedForRound(nextRound);
      await loadMatches();

      toast({
        title: `${nextRound} created`,
        description: 'Next playoff round has been generated automatically.',
      });
    } catch (error) {
      console.error('Error generating reseeded round:', error);
      toast({
        title: 'Failed to generate round',
        description: 'Could not create the next playoff round.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingReseedRound(false);
    }
  };

  useEffect(() => {
    if (!tournament?.playoff_reseeding || !isCreator || generatingReseedRound) return;

    const pendingRound = findPendingReseedRound(playoffMatches, true);
    if (pendingRound && pendingRound !== reseedFromRound && pendingRound !== reseedDialogDismissedForRound) {
      setReseedFromRound(pendingRound);
      generateReseededRound(pendingRound);
    }
  }, [playoffMatches, tournament?.playoff_reseeding, isCreator, generatingReseedRound]);

  const startPlayoffs = async () => {
    if (!tournament) return;

    const completedNonPlayoff = matches.filter(m => !m.is_playoff_match && m.status === 'completed');
    const teamsWithCompleted = new Set(completedNonPlayoff.flatMap(m => [m.team1_id, m.team2_id].filter(Boolean)));

    if (tournament.pool_play_enabled && tournament.teams_per_pool) {
      const poolNames = Array.from(new Set(teams.map(t => t.pool_name).filter(Boolean)));
      const everyPoolHasStarted = poolNames.length > 0 && poolNames.every(pool => {
        const poolTeams = teams.filter(t => t.pool_name === pool);
        return poolTeams.some(t => teamsWithCompleted.has(t.id));
      });
      if (!everyPoolHasStarted) {
        alert('At least one team in each pool must complete a match before the next phase can begin.');
        return;
      }
    } else {
      const allPlayed = teams.length > 0 && teams.every(t => teamsWithCompleted.has(t.id));
      if (!allPlayed) {
        alert('All teams must complete at least one match before playoffs can begin.');
        return;
      }
    }

    try {
      setStartingPlayoffs(true);

      const roundNames: Record<number, string> = {
        2: 'Finals',
        4: 'Semifinals',
        8: 'Quarterfinals',
        16: 'Round of 16',
        32: 'Round of 32',
      };

      const isPoolPlay = tournament.pool_play_enabled && tournament.teams_per_pool;
      const regularSeasonMatches = matches.filter((match) => !match.is_playoff_match);

      // Build the advancing teams list. For pool play, select the top pool_advance_count
      // from each pool individually so pool standings drive selection correctly.
      let topTeams: typeof standings = [];
      if (isPoolPlay && tournament.pool_advance_count) {
        const poolNames = Array.from(new Set(teams.map(t => t.pool_name).filter(Boolean))) as string[];
        for (const poolName of poolNames) {
          const poolTeamIds = new Set(teams.filter(t => t.pool_name === poolName).map(t => t.id));
          const poolStandings = sortStandingsForTiebreaker(
            standings.filter(s => poolTeamIds.has(s.team_id)),
            regularSeasonMatches
          ).slice(0, tournament.pool_advance_count!);
          topTeams.push(...poolStandings);
        }
      } else {
        let playoffTeamCount = tournament.playoff_teams;
        topTeams = sortStandingsForTiebreaker(standings, regularSeasonMatches).slice(0, playoffTeamCount);
      }

      if (topTeams.length < 2) {
        alert('Need at least 2 teams with completed matches to start playoffs');
        return;
      }

      const sortedForSeeding = sortStandingsForTiebreaker(topTeams, regularSeasonMatches);

      await Promise.all(
        sortedForSeeding.map((standing, index) =>
          supabase
            .from('tournament_teams')
            .update({ playoff_seed: index + 1 })
            .eq('id', standing.team_id)
        )
      );

      await loadTeams();

      await supabase
        .from('tournaments')
        .update({
          playoffs_started: true,
          playoffs_started_at: new Date().toISOString(),
        })
        .eq('id', tournament.id);

      const playoffMatchesToCreate: any[] = [];
      let bracketPosition = 1;

      // For pool play: pool_bye_count = number of top finishers PER POOL that get a bye.
      // Total bye teams = pool_bye_count * numPools.
      // For non-pool-play: playoff_byes = absolute number of top seeds that get a bye.
      let byeTeams: typeof standings = [];
      let playingTeams: typeof standings = [];

      if (isPoolPlay && (tournament.pool_bye_count || 0) > 0) {
        const poolNames = Array.from(new Set(teams.map(t => t.pool_name).filter(Boolean))) as string[];
        // Collect per-pool bye teams (top pool_bye_count from each pool).
        for (const poolName of poolNames) {
          const poolTeamIds = new Set(teams.filter(t => t.pool_name === poolName).map(t => t.id));
          const poolTopStandings = sortStandingsForTiebreaker(
            topTeams.filter(s => poolTeamIds.has(s.team_id)),
            regularSeasonMatches
          ).slice(0, tournament.pool_bye_count!);
          byeTeams.push(...poolTopStandings);
        }
        // Everyone else who advanced but didn't earn a bye plays the early round.
        const byeTeamIds = new Set(byeTeams.map(t => t.team_id));
        playingTeams = topTeams.filter(t => !byeTeamIds.has(t.team_id));
        // Sort both groups by overall seed for consistent bracket ordering.
        byeTeams = sortStandingsForTiebreaker(byeTeams, regularSeasonMatches);
        playingTeams = sortStandingsForTiebreaker(playingTeams, regularSeasonMatches);
      } else if (!isPoolPlay && (tournament.playoff_byes || 0) > 0) {
        const sorted = sortStandingsForTiebreaker(topTeams, regularSeasonMatches);
        byeTeams = sorted.slice(0, tournament.playoff_byes!);
        playingTeams = sorted.slice(tournament.playoff_byes!);
      }

      const totalByeCount = byeTeams.length;

      if (totalByeCount > 0) {
        // Determine round names from total bracket size.
        const totalBracketSize = Math.pow(2, Math.ceil(Math.log2(topTeams.length)));
        const earlyRoundName = roundNames[totalBracketSize] || `Round of ${totalBracketSize}`;
        const byeRoundName = roundNames[totalBracketSize / 2] || `Round of ${totalBracketSize / 2}`;

        // Early-round matches for non-bye teams.
        // bracket_position starts at totalByeCount+1 so it maps 1-to-1 onto the
        // bye-placeholder positions in the next round (advancePlayoffBracket looks up
        // nextRound matches with team2_id=null at the same bracket_position).
        const halfLen = Math.floor(playingTeams.length / 2);
        for (let i = 0; i < halfLen; i++) {
          const high = playingTeams[i];
          const low = playingTeams[playingTeams.length - 1 - i];
          const bp = totalByeCount + i + 1;
          playoffMatchesToCreate.push({
            tournament_id: tournament.id,
            match_number: 1000 + bracketPosition,
            round: earlyRoundName,
            team1_id: high.team_id,
            team2_id: low.team_id,
            seeding_position_team1: totalByeCount + i + 1,
            seeding_position_team2: topTeams.length - i,
            status: 'scheduled',
            is_playoff_match: true,
            playoff_round: earlyRoundName,
            bracket_position: bp,
          });
          bracketPosition++;
        }

        // Bye-round placeholder matches — team2_id filled when early-round match completes.
        for (let i = 0; i < byeTeams.length; i++) {
          playoffMatchesToCreate.push({
            tournament_id: tournament.id,
            match_number: 2000 + i + 1,
            round: byeRoundName,
            team1_id: byeTeams[i].team_id,
            team2_id: null,
            seeding_position_team1: i + 1,
            seeding_position_team2: null,
            status: 'scheduled',
            is_playoff_match: true,
            playoff_round: byeRoundName,
            bracket_position: i + 1,
          });
        }
      } else {
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(topTeams.length)));
        const roundName = roundNames[nextPowerOf2] || `Round of ${nextPowerOf2}`;

        // Standard tournament seeding: seed 1 vs last, seed 2 vs second-last, etc.
        // e.g. 4 teams: (1v4), (2v3); 8 teams: (1v8), (2v7), (3v6), (4v5)
        const halfLen = Math.floor(topTeams.length / 2);
        for (let i = 0; i < halfLen; i++) {
          const high = topTeams[i];
          const low = topTeams[topTeams.length - 1 - i];
          playoffMatchesToCreate.push({
            tournament_id: tournament.id,
            match_number: 1000 + bracketPosition,
            round: roundName,
            team1_id: high.team_id,
            team2_id: low.team_id,
            seeding_position_team1: i + 1,
            seeding_position_team2: topTeams.length - i,
            status: 'scheduled',
            is_playoff_match: true,
            playoff_round: roundName,
            bracket_position: bracketPosition,
          });
          bracketPosition++;
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
      toast({
       description: 'Failed to start playoffs'
      }
        );
    } finally {
      setStartingPlayoffs(false);
    }
  };


  const advancePlayoffBracket = async (completedMatch: TournamentMatch, winnerId: string) => {
    if (!tournament) return;
    if (completedMatch.playoff_round === 'Finals') return;

    const rounds: Record<string, string> = {
      'Round of 32': 'Round of 16',
      'Round of 16': 'Quarterfinals',
      'Quarterfinals': 'Semifinals',
      'Semifinals': 'Finals',
      // Legacy label used before pool-play bye naming was introduced
      'First Round': 'Semifinals',
    };

    const nextRound = rounds[completedMatch.playoff_round || ''];
    if (!nextRound) return;

    const pos = completedMatch.bracket_position ?? 0;

    // Bye placeholders occupy bracket_position 1..byeCount in the next round.
    // Early-round matches occupy bracket_position byeCount+1..2*byeCount.
    // So an early-round match at position P always maps to the bye placeholder at P - byeCount.
    // We count ALL bye-round matches (not just null ones) to get the stable original byeCount.
    const { data: allByeRoundMatches } = await supabase
      .from('tournament_matches')
      .select('id, bracket_position, team2_id')
      .eq('tournament_id', tournament.id)
      .eq('is_playoff_match', true)
      .eq('playoff_round', nextRound)
      .is('deleted_at', null);

    const totalByes = allByeRoundMatches?.length ?? 0;

    if (totalByes > 0) {
      // Derive the corresponding bye-placeholder bracket_position for this early-round match.
      const byeSlot = pos - totalByes;
      const byePlaceholder = allByeRoundMatches!.find(p => p.bracket_position === byeSlot);

      if (byePlaceholder) {
        await supabase
          .from('tournament_matches')
          .update({ team2_id: winnerId })
          .eq('id', byePlaceholder.id);
        await loadMatches();
        return;
      }
    }

    if (tournament.playoff_reseeding) {
      await loadMatches();
      return;
    }

    // Standard advancement: pair bracket positions (1,2), (3,4), etc.
    const { data: playoffMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('is_playoff_match', true)
      .eq('playoff_round', completedMatch.playoff_round)
      .is('deleted_at', null);

    if (!playoffMatches) return;

    const pairedPos = pos % 2 === 1 ? pos + 1 : pos - 1;
    const pairedMatch = playoffMatches.find(m => m.bracket_position === pairedPos);

    // Wait until both paired matches are complete
    if (!pairedMatch || pairedMatch.status !== 'completed' || !pairedMatch.winner_team_id) return;

    const nextBracketPosition = Math.ceil(Math.min(pos, pairedPos) / 2);

    const lowerPosWinner = pos < pairedPos ? winnerId : pairedMatch.winner_team_id;
    const higherPosWinner = pos < pairedPos ? pairedMatch.winner_team_id : winnerId;

    // Check if a next-round match already exists
    const { data: existing } = await supabase
      .from('tournament_matches')
      .select('id, team1_id, team2_id')
      .eq('tournament_id', tournament.id)
      .eq('is_playoff_match', true)
      .eq('playoff_round', nextRound)
      .eq('bracket_position', nextBracketPosition)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('tournament_matches')
        .update({ team1_id: lowerPosWinner, team2_id: higherPosWinner })
        .eq('id', existing.id);
    } else {
      const { data: maxMatch } = await supabase
        .from('tournament_matches')
        .select('match_number')
        .eq('tournament_id', tournament.id)
        .order('match_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextMatchNumber = (maxMatch?.match_number ?? 1000) + 1;

      await supabase.from('tournament_matches').insert({
        tournament_id: tournament.id,
        match_number: nextMatchNumber,
        round: nextRound,
        team1_id: lowerPosWinner,
        team2_id: higherPosWinner,
        status: 'scheduled',
        is_playoff_match: true,
        playoff_round: nextRound,
        bracket_position: nextBracketPosition,
      });
    }

    await loadMatches();
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

      if (
        tournament?.is_dupr_required &&
        tournament?.dupr_plus_required_subs &&
        tournament.dupr_plus_required_subs.length > 0 &&
        profile?.dupr_id
      ) {
        const { data: subCache } = await supabase
          .from('dupr_subscriptions_cache')
          .select('tournaments, expires_at')
          .eq('dupr_id', profile.dupr_id)
          .maybeSingle();

        if (!subCache || new Date(subCache.expires_at) < new Date()) {
          toast({
            title: 'Subscription status unavailable',
            description: 'Your DUPR subscription status could not be verified. Please refresh your DUPR profile and try again.',
            variant: 'destructive',
          });
          return;
        }

        const hasRequiredSub = tournament.dupr_plus_required_subs.some((required) =>
          subCache.tournaments.includes(required)
        );

        if (!hasRequiredSub) {
          const tierLabels: Record<string, string> = { PREMIUM_L1: 'Premium', VERIFIED_L1: 'Verified' };
          const friendlyTiers = tournament.dupr_plus_required_subs
            .filter(t => t !== 'BASIC_L1')
            .map(t => tierLabels[t] ?? t);
          toast({
            title: 'DUPR+ subscription required',
            description: `This tournament requires a DUPR ${friendlyTiers.join(' or ')} subscription to join.`,
            variant: 'destructive',
          });
          return;
        }
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

  const copyShareLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/t/${params.id}`;
      const result = await copyToClipboard(shareUrl);

      if (result.success) {
        setShareLinkCopied(true);
        setTimeout(() => setShareLinkCopied(false), 2000);
        toast({
          title: 'Link copied!',
          description: 'Tournament link copied to clipboard',
        });
      } else {
        toast({
          title: 'Failed to copy',
          description: result.error || 'Could not copy link to clipboard',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error copying share link:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while copying link',
        variant: 'destructive',
      });
    }
  };

  const copyAccessCode = async () => {
    try {
      if (!tournament?.access_code) {
        toast({
          title: 'No access code',
          description: 'This tournament does not have an access code',
          variant: 'destructive',
        });
        return;
      }

      const result = await copyToClipboard(tournament.access_code);
      if (result.success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: 'Access code copied!',
          description: 'Code copied to clipboard',
        });
      } else {
        toast({
          title: 'Failed to copy',
          description: result.error || 'Could not copy access code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error copying access code:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while copying',
        variant: 'destructive',
      });
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
      <div className="container p-8">
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
  const showSettingsTab = isCreator;
  const tabsListClass = showSettingsTab
    ? (tournament.has_playoffs ? 'sm:grid-cols-5' : 'sm:grid-cols-4')
    : (tournament.has_playoffs ? 'sm:grid-cols-4' : 'sm:grid-cols-3');
  const hasLockedResults = matches.some(
    (m) =>
      !m.is_playoff_match &&
      (m.status === 'completed' ||
        m.status === 'in_progress' ||
        m.game1_team1_points != null ||
        m.game1_team2_points != null),
  );

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

  const getStandingsShareRows = () =>
    standings.map((s) => {
      const players = formatTeamPlayersAmp(s.team)?.trim();
      const label =
        players && players !== '—'
          ? players
          : s.team?.team_name?.trim() || `Team ${s.team?.team_number ?? '?'}`;
      return {
        label,
        wins: s.wins ?? 0,
        losses: s.losses ?? 0,
        pointDifferential: s.point_differential ?? 0,
      };
    });

  const getRegularSeasonGameCounts = () => {
    const nonPlayoffMatches = matches.filter((m) => !m.is_playoff_match);
    const bestOf = tournament.best_of || 3;
    let completedGamesCount = 0;
    nonPlayoffMatches.forEach((match) => {
      if (match.status === 'completed') {
        completedGamesCount += (match.team1_games_won || 0) + (match.team2_games_won || 0);
      }
    });
    return { completedGamesCount, totalPossibleGames: nonPlayoffMatches.length * bestOf };
  };

  const handleSharePlayoffs = async () => {
    if (!tournament) return;

    if (standings.length === 0 && playoffMatches.length === 0) {
      toast({
        title: 'Nothing to share',
        description: 'No standings or playoff results available to copy',
        variant: 'destructive',
      });
      return;
    }

    try {
      const header = formatTournamentShareHeader(tournament.name, tournament.date, tournament.start_time);

      const { completedGamesCount, totalPossibleGames } = getRegularSeasonGameCounts();
      const standingsBlock = buildStandingsShareBlock(
        getStandingsShareRows(),
        completedGamesCount,
        totalPossibleGames,
      );

      const playoffRows: PlayoffMatchShareRow[] = playoffMatches.map((match) => ({
        playoffRound: match.playoff_round || 'Playoffs',
        team1Label: formatTeamPlayersAmp(match.team1) || 'TBD',
        team2Label: formatTeamPlayersAmp(match.team2) || 'TBD',
        seed1: match.seeding_position_team1,
        seed2: match.seeding_position_team2,
        status: match.status,
        gameScores: extractMatchGameScores(match as unknown as Record<string, unknown>, tournament.best_of || 3),
        team1GamesWon: match.team1_games_won,
        team2GamesWon: match.team2_games_won,
      }));

      const champTeam = tournament.champion_team_id
        ? teams.find((t) => t.id === tournament.champion_team_id)
        : null;
      const championLabel = champTeam ? formatTeamPlayersAmp(champTeam) : null;

      const playoffsBlock = buildPlayoffsShareBlock(playoffRows, championLabel);
      const text = buildPlayoffsAndStandingsShareText(header, standingsBlock, playoffsBlock);

      const result = await copyToClipboard(text.trim());

      if (result.success) {
        setSharePlayoffsCopied(true);
        toast({
          title: 'Playoffs copied',
          description: 'Standings and playoff results ready to paste',
        });
        setTimeout(() => setSharePlayoffsCopied(false), 2200);
      } else {
        toast({
          title: 'Failed to copy',
          description: result.error || 'Could not copy playoff results to clipboard',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error in handleSharePlayoffs:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while copying playoff results',
        variant: 'destructive',
      });
    }
  };


  // Detect Round Robin Individual format and render different interface
  if (tournament.format === 'round_robin_individual') {
    return (
      <KingOfTheHillPage
        tournament={tournament}
        isCreator={isCreator}
        currentUserId={currentUserId}
        canSyncToDupr={canSyncToDupr}
        onBack={() => router.push('/dashboard/tournaments')}
        onTournamentUpdate={refreshTournament}
      />
    );
  }

  return (
    <div className="container py-8">
      <button
        onClick={() => router.push('/dashboard/tournaments')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Tournaments
      </button>
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
              {tournament.is_private && <Badge variant="secondary">Private</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-gray-900 border-gray-300">
                {tournament.team_format === 'singles' ? 'Singles' : 'Doubles'}
              </Badge>
              <Badge variant="outline" className="text-gray-900 border-gray-300">
                {tournament.format === 'round_robin' && (tournament.has_playoffs ? 'Round Robin + Playoffs' : 'Round Robin')}
                {tournament.format === 'group_stage_playoffs' && (tournament.has_playoffs ? 'Group Stage + Playoffs' : 'Tournament')}
                {tournament.format === 'round_robin_individual' && (tournament.has_playoffs ? 'Round Robin + Playoffs' : 'Round Robin')}
              </Badge>
              {tournament.format !== 'round_robin_individual' && tournament.has_playoffs && tournament.playoff_teams && (
                <Badge variant="outline" className="text-gray-900 border-gray-300">{tournament.playoff_teams} playoff spots</Badge>
              )}
              {tournament.format === 'round_robin_individual' && tournament.has_playoffs && tournament.playoff_qualifiers && (
                <Badge variant="outline" className="text-gray-900 border-gray-300">{tournament.playoff_qualifiers} playoff spots</Badge>
              )}
              {tournament.format === 'round_robin_individual' && tournament.best_of > 1 && (
                <Badge variant="outline" className="text-gray-900 border-gray-300">Best of {tournament.best_of}</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="flex-shrink-0"
            >
              <Copy className="h-4 w-4 mr-2" />
              Share Link
            </Button>
            {(isCreator && isDeleteTournamentShow) && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-500 hover:bg-red-500/10 flex-shrink-0"
                onClick={() => setShowDeleteTournament(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {tournament.is_dupr_required && tournament.dupr_plus_required_subs && tournament.dupr_plus_required_subs.filter(t => t !== 'BASIC_L1').length > 0 && (
        <div className="mb-6 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">DUPR+ Subscription Required</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">Players must hold one of the following subscriptions to join:</p>
          <div className="flex flex-wrap gap-1.5">
            {tournament.dupr_plus_required_subs.filter(t => t !== 'BASIC_L1').map((tier) => {
              const tierLabels: Record<string, string> = { PREMIUM_L1: 'Premium', VERIFIED_L1: 'Verified' };
              return (
                <span key={tier} className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                  {tierLabels[tier] ?? tier}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {tournament.pool_play_enabled && tournament.teams_per_pool && (
        <div className="mb-6 p-3 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Pool Play</p>
          {(() => {
            const numPools = Math.ceil((tournament.expected_teams || 0) / tournament.teams_per_pool!);
            const totalAdvancing = (tournament.pool_advance_count || 0) * numPools;
            const byePerPool = tournament.pool_bye_count || 0;
            const totalByes = byePerPool * numPools;
            const playInTeams = totalAdvancing - totalByes;
            return (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {numPools} pool{numPools !== 1 ? 's' : ''} of {tournament.teams_per_pool} teams
                {' · '}each team plays {tournament.games_per_pool} opponent{tournament.games_per_pool !== 1 ? 's' : ''}
                {' · '}top {tournament.pool_advance_count} per pool advance ({totalAdvancing} total)
                {totalByes > 0
                  ? ` · top ${byePerPool} from each pool get a bye (${totalByes} total), ${playInTeams} others play first round`
                  : ' · all advancing teams play first round'}
              </p>
            );
          })()}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:flex-1">
          <ScrollableTabsList desktopClassName={tabsListClass}>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            {showSettingsTab && (
              <TabsTrigger value="settings">Settings</TabsTrigger>
            )}
            {tournament.has_playoffs && (
              <TabsTrigger value="playoffs">
                <Trophy className="h-4 w-4 mr-1" />
                Playoffs
              </TabsTrigger>
            )}
          </ScrollableTabsList>
        </Tabs>
        {canSyncToDupr && tournament?.dupr_club_id && (
          <Button
            onClick={syncToDupr}
            disabled={syncingToDupr}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {syncingToDupr ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4 mr-2" />
                Sync to DUPR
              </>
            )}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="hidden">
          <TabsList>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            {showSettingsTab && (
              <TabsTrigger value="settings">Settings</TabsTrigger>
            )}
            {tournament.has_playoffs && (
              <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="teams" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tournament Teams</CardTitle>
              <CardDescription>
                {tournament.team_format === 'singles' ? (tournament.registered_players_count || 0) : Math.floor((tournament.registered_players_count || 0) / 2)} of {tournament.expected_teams} teams fully registered
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
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {team.team_name || `Team ${team.team_number}`}
                                </span>
                                {team.group_name && (
                                  <Badge variant="outline" className="text-xs">
                                    Group {team.group_name}
                                  </Badge>
                                )}
                                {team.pool_name && (
                                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-400">
                                    {team.pool_name}
                                  </Badge>
                                )}
                              </div>
                              {isCreator && (
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

      {isCreator && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roster & schedule</CardTitle>
              <CardDescription>
                {matches.length === 0
                  ? 'Add teams, then generate the schedule when ready.'
                  : hasLockedResults
                    ? 'You can add teams mid-tournament. Rebuild keeps completed rounds and realigns the rest (catch-up games go last).'
                    : 'Roster changed? Rebuild replaces unplayed matches for the current teams.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addTeamSlot}
                disabled={addingTeamSlot}
                className="sm:flex-1"
              >
                {addingTeamSlot ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Team Slot
                  </>
                )}
              </Button>
              {matches.length === 0 ? (
                <Button
                  onClick={generateSchedule}
                  disabled={generatingSchedule || filledTeams.length < 2}
                  className="sm:flex-1"
                >
                  {generatingSchedule ? 'Generating...' : 'Create Tournament Schedule'}
                </Button>
              ) : (
                <Button
                  onClick={openRebuildDialog}
                  disabled={rebuildingSchedule || filledTeams.length < 2}
                  className="sm:flex-1"
                >
                  Rebuild Schedule
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </TabsContent>

    <TabsContent value="schedule" className="mt-6">
      <div className="space-y-6">
        {(() => {
          const isPoolPlay = tournament?.pool_play_enabled && tournament?.teams_per_pool;
          if (!isCreator || (!tournament?.has_playoffs && !isPoolPlay) || tournament?.playoffs_started) return null;
          const completedMatches = matches.filter(m => !m.is_playoff_match && m.status === 'completed');
          if (completedMatches.length === 0) return null;
          const teamsWithMatch = new Set(completedMatches.flatMap(m => [m.team1_id, m.team2_id].filter(Boolean)));

          if (tournament.pool_play_enabled && tournament.teams_per_pool) {
            const poolNames = Array.from(new Set(teams.map(t => t.pool_name).filter(Boolean)));
            const everyPoolHasStarted = poolNames.length > 0 && poolNames.every(pool => {
              const poolTeams = teams.filter(t => t.pool_name === pool);
              return poolTeams.some(t => teamsWithMatch.has(t.id));
            });
            if (!everyPoolHasStarted) return null;
            return (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm">Ready to advance to playoffs</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pool play is underway. You can generate the playoff bracket now.</p>
                  </div>
                  <Button onClick={startPlayoffs} disabled={startingPlayoffs} className="ml-4 shrink-0">
                    {startingPlayoffs ? 'Generating...' : 'Generate Playoffs'}
                  </Button>
                </CardContent>
              </Card>
            );
          }

          const everyTeamHasPlayed = teams.length > 0 && teams.every(t => teamsWithMatch.has(t.id));
          if (!everyTeamHasPlayed) return null;
          return (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold text-sm">Ready to start playoffs</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Every team has played at least one match. You can generate the playoff bracket now.</p>
                </div>
                <Button onClick={startPlayoffs} disabled={startingPlayoffs} className="ml-4 shrink-0">
                  {startingPlayoffs ? 'Generating...' : 'Generate Playoffs'}
                </Button>
              </CardContent>
            </Card>
          );
        })()}
        {matches.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Match Schedule</CardTitle>
              <CardDescription>Click on a match to enter scores</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const renderMatchCard = (match: TournamentMatch, showRound = false) => (
                  <div
                    key={match.id}
                    className={`bg-card border rounded-lg overflow-hidden hover:shadow-md hover:border-primary/50 transition-all ${
                      match.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {showRound && (
                            <Badge variant="outline" className="text-xs">{match.round || 'Unassigned'}</Badge>
                          )}
                          {match.status === 'completed' && !match.is_score_confirmed && (
                            <Badge className="bg-amber-500 text-white text-xs">Pending Confirmation</Badge>
                          )}
                          {match.status === 'completed' && match.is_score_confirmed && (
                            <Badge className="bg-green-600 text-xs">Completed</Badge>
                          )}
                          {match.status === 'in_progress' && (
                            <Badge className="bg-blue-600 text-white text-xs">In Progress</Badge>
                          )}
                          {match.status === 'scheduled' && (
                            <Badge variant="secondary" className="text-xs">Pending</Badge>
                          )}
                        </div>
                        {isCreator && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMatch(match);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="cursor-pointer" onClick={() => openScoreDialog(match)}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 rounded bg-muted/50">
                            <div className="flex-1 mr-2 min-w-[120px]">
                              <div className="text-base font-medium">{formatTeamPlayers(match.team1)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {[
                                { team1: match.game1_team1_points, team2: match.game1_team2_points },
                                { team1: match.game2_team1_points, team2: match.game2_team2_points },
                                { team1: match.game3_team1_points, team2: match.game3_team2_points },
                                { team1: match.game4_team1_points, team2: match.game4_team2_points },
                                { team1: match.game5_team1_points, team2: match.game5_team2_points },
                              ].slice(0, tournament?.best_of || 3).map((game, idx) => {
                                if (game.team1 == null || game.team2 == null) {
                                  return match.status === 'completed' ? null : (
                                    <div key={idx} className="w-12 h-10 flex items-center justify-center rounded bg-muted/50 text-muted-foreground font-semibold">-</div>
                                  );
                                }
                                return (
                                  <div key={idx} className={`w-12 h-10 flex items-center justify-center rounded font-semibold ${game.team1 > game.team2 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                    {game.team1}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center justify-center py-1">
                            <span className="text-xs font-semibold text-muted-foreground">VS</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded bg-muted/50">
                            <div className="flex-1 mr-2 min-w-[120px]">
                              <div className="text-base font-medium">{formatTeamPlayers(match.team2)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {[
                                { team1: match.game1_team1_points, team2: match.game1_team2_points },
                                { team1: match.game2_team1_points, team2: match.game2_team2_points },
                                { team1: match.game3_team1_points, team2: match.game3_team2_points },
                                { team1: match.game4_team1_points, team2: match.game4_team2_points },
                                { team1: match.game5_team1_points, team2: match.game5_team2_points },
                              ].slice(0, tournament?.best_of || 3).map((game, idx) => {
                                if (game.team1 == null || game.team2 == null) {
                                  return match.status === 'completed' ? null : (
                                    <div key={idx} className="w-12 h-10 flex items-center justify-center rounded bg-muted/50 text-muted-foreground font-semibold">-</div>
                                  );
                                }
                                return (
                                  <div key={idx} className={`w-12 h-10 flex items-center justify-center rounded font-semibold ${game.team2 > game.team1 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                    {game.team2}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                const scheduleTeams = teams.filter((team) =>
                  matches.some((match) => match.team1_id === team.id || match.team2_id === team.id),
                );
                const activeScheduleTeamId =
                  scheduleTeams.some((team) => team.id === selectedScheduleTeamId)
                    ? selectedScheduleTeamId
                    : scheduleTeams[0]?.id || '';
                const activeScheduleTeam = scheduleTeams.find((team) => team.id === activeScheduleTeamId);
                const teamScheduleMatches = matches.filter(
                  (match) => match.team1_id === activeScheduleTeamId || match.team2_id === activeScheduleTeamId,
                );
                const getScheduleTeamLabel = (team: TournamentTeam) =>
                  team.team_name?.trim() || formatTeamPlayers(team) || `Team ${team.team_number}`;
                const scheduleTeamLabels = Object.fromEntries(
                  scheduleTeams.map((team) => [team.id, getScheduleTeamLabel(team)]),
                );

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        aria-pressed={scheduleView === 'rounds'}
                        onClick={() => setScheduleView('rounds')}
                        className={scheduleView === 'rounds'
                          ? 'border-green-300 bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800'
                          : ''}
                      >
                        Rounds
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-pressed={scheduleView === 'teams'}
                        onClick={() => setScheduleView('teams')}
                        className={scheduleView === 'teams'
                          ? 'border-green-300 bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800'
                          : ''}
                      >
                        Teams
                      </Button>
                    </div>

                    {scheduleView === 'teams' ? (
                      <div className="space-y-6">
                        <Tabs value={activeScheduleTeamId} onValueChange={setSelectedScheduleTeamId}>
                          <ScrollableRoundTabs
                            rounds={scheduleTeams.map((team) => team.id)}
                            labels={scheduleTeamLabels}
                            ariaLabel="teams"
                          />
                        </Tabs>

                        {activeScheduleTeam ? (
                          <div className="space-y-3">
                            <div>
                              <h3 className="font-semibold">{getScheduleTeamLabel(activeScheduleTeam)}</h3>
                              <p className="text-sm text-muted-foreground">
                                {teamScheduleMatches.length} {teamScheduleMatches.length === 1 ? 'match' : 'matches'}
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {teamScheduleMatches.map((match) => renderMatchCard(match, true))}
                            </div>
                          </div>
                        ) : (
                          <p className="py-6 text-center text-sm text-muted-foreground">
                            No teams are assigned to this schedule.
                          </p>
                        )}
                      </div>
                    ) : tournament?.pool_play_enabled ? (
                      (() => {
                        // For pool play: group matches by pool, then by round within each pool
                        const poolNames = Array.from(new Set(matches.map(m => m.pool_name || 'Pool 1'))).sort();
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
                        const defaultRound = determineDefaultRound(matchesByRound, sortedRounds);
                        const emptyCounts = getEmptyGameCounts(matchesByRound);
                        return (
                          <Tabs value={selectedRound || defaultRound} onValueChange={setSelectedRound} className="w-full">
                            <ScrollableRoundTabs rounds={sortedRounds} emptyCounts={emptyCounts} />
                            {sortedRounds.map((round) => (
                              <TabsContent key={round} value={round} className="mt-6 space-y-6">
                                {poolNames.map((poolName) => {
                                  const poolRoundMatches = (matchesByRound[round] || []).filter(m => (m.pool_name || 'Pool 1') === poolName);
                                  if (poolRoundMatches.length === 0) return null;
                                  return (
                                    <div key={poolName}>
                                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 border-b pb-2">{poolName}</h4>
                                      <div className="grid gap-4 md:grid-cols-2">
                                        {poolRoundMatches.map((match) => renderMatchCard(match))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </TabsContent>
                            ))}
                          </Tabs>
                        );
                      })()
                    ) : (
                      (() => {
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

                        const defaultRound = determineDefaultRound(matchesByRound, sortedRounds);
                        const emptyCounts = getEmptyGameCounts(matchesByRound);

                        return (
                          <Tabs value={selectedRound || defaultRound} onValueChange={setSelectedRound} className="w-full">
                            <ScrollableRoundTabs rounds={sortedRounds} emptyCounts={emptyCounts} />
                            {sortedRounds.map((round) => (
                              <TabsContent key={round} value={round} className="mt-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                  {matchesByRound[round].map((match) => renderMatchCard(match))}
                                </div>
                              </TabsContent>
                            ))}
                          </Tabs>
                        );
                      })()
                    )}
                  </div>
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

      </div>
    </TabsContent>

    <TabsContent value="standings" className="mt-6">
      <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
            <CardTitle>Standings</CardTitle>
            <CardDescription>Rankings based on individual games won (not matches)</CardDescription>
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
            <div className="space-y-4">
              {(() => {
                  const renderStandingsTable = (rows: typeof standings, advanceCount?: number) => (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-semibold text-sm">Rank</th>
                            <th className="text-left py-3 px-2 font-semibold text-sm">Team</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm" title="Games Won">GW</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm" title="Games Lost">GL</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm hidden sm:table-cell">PF</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm hidden sm:table-cell">PA</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm">PtDiff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((standing, index) => {
                            const advances = advanceCount !== undefined && index < advanceCount;
                            return (
                              <tr key={standing.id} className={`border-b hover:bg-muted/50 ${tournament.champion_team_id === standing.team_id ? 'bg-gradient-to-r from-primary/10 to-secondary/10' : advances ? 'bg-blue-500/5' : ''}`}>
                                <td className="py-3 px-2 font-bold">#{index + 1}</td>
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-2">
                                    {tournament.champion_team_id === standing.team_id && (
                                      <Trophy className="h-5 w-5 text-primary fill-primary" />
                                    )}
                                    <span className="font-medium">{formatTeamPlayers(standing.team)}</span>
                                    {tournament.champion_team_id === standing.team_id && (
                                      <Badge className="bg-gradient-to-r from-primary to-secondary text-white">Champion</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-center font-semibold text-green-600">{standing.wins}</td>
                                <td className="py-3 px-2 text-center font-semibold text-red-600">{standing.losses}</td>
                                <td className="py-3 px-2 text-center font-semibold hidden sm:table-cell">{standing.points_for}</td>
                                <td className="py-3 px-2 text-center font-semibold hidden sm:table-cell">{standing.points_against}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className={`font-semibold ${standing.point_differential >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {standing.point_differential > 0 ? '+' : ''}{standing.point_differential}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );

                  if (tournament.pool_play_enabled && tournament.teams_per_pool) {
                    const poolNames = Array.from(new Set(teams.map(t => t.pool_name).filter(Boolean))).sort() as string[];
                    if (poolNames.length > 0) {
                      return poolNames.map((poolName) => {
                        const poolStandings = sortStandingsForTiebreaker(
                          standings.filter(s => s.team?.pool_name === poolName)
                        );
                        if (poolStandings.length === 0) return null;
                        return (
                          <div key={poolName} className="space-y-2">
                            <h3 className="font-semibold text-lg border-b pb-2 mb-3">{poolName}</h3>
                            {renderStandingsTable(poolStandings, tournament.pool_advance_count ?? undefined)}
                          </div>
                        );
                      });
                    }
                  }

                  if (tournament.groups_enabled && tournament.number_of_groups) {
                    const { getAllGroupNames } = require('@/lib/group-helpers');
                    const groupNames = getAllGroupNames(tournament.number_of_groups);
                    return groupNames.map((groupName: string) => {
                      const groupStandings = sortStandingsForTiebreaker(
                        standings.filter(s => s.team?.group_name === groupName)
                      );
                      if (groupStandings.length === 0) return null;
                      return (
                        <div key={groupName} className="space-y-2">
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Group {groupName}</h3>
                          {renderStandingsTable(groupStandings)}
                        </div>
                      );
                    });
                  }

                  return renderStandingsTable(standings);
                })()}
            </div>
          </CardContent>
        </Card>
    </TabsContent>

    {showSettingsTab && (
      <TabsContent value="settings" className="mt-6">
        <TournamentTeamSettingsForm
          tournament={tournament}
          teams={teams}
          onSaved={async () => {
            await refreshTournament();
            await loadTeams();
          }}
        />
      </TabsContent>
    )}

    {tournament.has_playoffs && (
    <TabsContent value="playoffs" className="mt-6 space-y-4">
      {playoffMatches.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Playoff Bracket
              </CardTitle>
              <CardDescription>Knockout tournament - Top {tournament.playoff_teams} teams advancing</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSharePlayoffs}
              disabled={standings.length === 0 && playoffMatches.length === 0}
              className="gap-2 shrink-0"
            >
              {sharePlayoffsCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Share Playoffs
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <PlayoffBracket
              matches={playoffMatches}
              onMatchClick={openScoreDialog}
              onDeleteMatch={(match) => {
                setSelectedMatch(match);
                setShowDeleteDialog(true);
              }}
              isSingles={tournament.team_format === 'singles'}
              isCreator={isCreator}
              bestOf={tournament.best_of}
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
            <p>Playoffs have not started yet</p>
            {isCreator && tournament?.has_playoffs && !tournament?.playoffs_started && (
              <Button
                onClick={startPlayoffs}
                disabled={startingPlayoffs}
                className="mt-4"
              >
                {startingPlayoffs ? 'Generating...' : 'Generate Playoffs'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>
    )}
  </Tabs>

      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMatch?.match_status === 'completed' ? 'Match Complete' : 'Enter Match Score'}
            </DialogTitle>
            <DialogDescription>
              Best of {tournament?.best_of || 3} - First to {Math.ceil((tournament?.best_of || 3) / 2)} games wins
            </DialogDescription>
            {selectedMatch && (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <Badge variant={selectedMatch.match_status === 'completed' ? 'default' : 'secondary'} className="text-sm">
                  {selectedMatch.match_status === 'completed'
                    ? `Match Complete: ${formatTeamPlayersAmp(selectedMatch.team1)} ${selectedMatch.team1_games_won} - ${selectedMatch.team2_games_won} ${formatTeamPlayersAmp(selectedMatch.team2)}`
                    : `Series: ${selectedMatch.team1_games_won || 0} - ${selectedMatch.team2_games_won || 0}`}
                </Badge>
                {selectedMatch.is_score_confirmed ? (
                  <Badge className="bg-green-600 text-white text-xs">Confirmed</Badge>
                ) : (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 ? (
                  <Badge className="bg-amber-500 text-white text-xs">Pending Confirmation</Badge>
                ) : null}
              </div>
            )}
            {selectedMatch && !tournament?.dupr_club_id && !selectedMatch.is_score_confirmed && (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 && canUserConfirmScore() && (
              <p className="text-xs text-muted-foreground pt-1">Scores have been submitted and are awaiting your confirmation.</p>
            )}
            {selectedMatch && tournament?.dupr_club_id && !selectedMatch.is_score_confirmed && (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 && (
              <p className="text-xs text-muted-foreground pt-1">Scores will be confirmed when synced to DUPR.</p>
            )}
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
            {Array.from({ length: tournament?.best_of || 3 }, (_, i) => i + 1).map((gameNum) => {
              const team1Score = selectedMatch?.[`game${gameNum}_team1_points` as keyof TournamentMatch] as number | null;
              const team2Score = selectedMatch?.[`game${gameNum}_team2_points` as keyof TournamentMatch] as number | null;
              const isCompleted = team1Score !== null && team2Score !== null;

              const gamesToWin = Math.ceil((tournament?.best_of || 3) / 2);
              const team1GamesWon = selectedMatch?.team1_games_won || 0;
              const team2GamesWon = selectedMatch?.team2_games_won || 0;
              const matchDecided = team1GamesWon >= gamesToWin || team2GamesWon >= gamesToWin;

              const hasAccess = canUserEnterScore(selectedMatch!);
              return (
                <GameScoreInput
                  key={gameNum}
                  gameNumber={gameNum}
                  team1Name={formatTeamPlayersAmp(selectedMatch?.team1)}
                  team2Name={formatTeamPlayersAmp(selectedMatch?.team2)}
                  team1Score={team1Score}
                  team2Score={team2Score}
                  isCompleted={isCompleted}
                  isDisabled={!hasAccess}
                  onScoreChange={handleScoreChange}
                  canEdit={hasAccess}
                  matchDecided={matchDecided}
                />
              );
            })}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button variant="outline" onClick={() => setShowScoreDialog(false)} className="w-full sm:w-auto">
                Close
              </Button>
              <div className="flex-1" />
              {canUserEnterScore(selectedMatch!) && (
                <Button
                  onClick={submitAllScores}
                  disabled={submittingScores}
                  className="w-full sm:w-auto bg-[hsl(var(--ring))] text-black hover:bg-[hsl(var(--ring))]/90"
                >
                  {submittingScores ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Scores'
                  )}
                </Button>
              )}
              {canUserConfirmScore() && !tournament?.dupr_club_id && !selectedMatch?.is_score_confirmed && (selectedMatch?.team1_games_won || 0) + (selectedMatch?.team2_games_won || 0) > 0 && (
                <Button
                  onClick={() => selectedMatch && confirmMatchScore(selectedMatch)}
                  disabled={confirmingScore}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                >
                  {confirmingScore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    'Confirm Scores'
                  )}
                </Button>
              )}
              {isCreator && selectedMatch?.match_status === 'completed' && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Match
                </Button>
              )}
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

      <Dialog open={showRebuildDialog} onOpenChange={setShowRebuildDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rebuild schedule?</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {rebuildPreview ||
                'Completed and in-progress matches stay. Unplayed matches are replaced so the schedule matches the current roster.'}
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Catch-up games for late joins are placed in a final Catch-up round. Teams that join mid-playoffs are treated as having a bye for rounds they missed.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRebuildDialog(false)} disabled={rebuildingSchedule}>
              Cancel
            </Button>
            <Button onClick={rebuildScheduleFromRoster} disabled={rebuildingSchedule}>
              {rebuildingSchedule ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rebuilding...
                </>
              ) : (
                'Rebuild Schedule'
              )}
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

      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Tournament</DialogTitle>
            <DialogDescription>
              Share this link with others to let them view or join the tournament
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/t/${params.id}`}
                className="flex-1"
              />
              <Button
                onClick={copyShareLink}
                variant="outline"
                className="flex-shrink-0"
              >
                {shareLinkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
