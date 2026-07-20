  'use client';
  
  import { useEffect, useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { supabase } from '@/lib/supabase/client';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Badge } from '@/components/ui/badge';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import {
    ArrowLeft, Calendar, MapPin, Users, Copy, Check,
    CircleAlert as AlertCircle, ShieldAlert, UserPlus, X, Loader as Loader2, Trash2, CloudUpload, Trophy, Crown
  } from 'lucide-react';
  import { Label } from '@/components/ui/label';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { ScrollableTabsList } from '@/components/scrollable-tabs-list';
  import { ScrollableRoundTabs, getEmptyGameCounts } from '@/components/scrollable-round-tabs';
  import { useToast } from '@/hooks/use-toast';
  import { getDisplayName } from '@/lib/utils';
  import { generateSinglesSchedule, generateDoublesSchedule, Player } from '@/lib/pickup-scheduling';
  import { Tournament, TournamentMatch, TournamentTeam } from './page';
  import { GameScoreInput } from '@/components/game-score-input';
  import { copyToClipboard } from '@/lib/clipboard-utils';
  import {
    buildPlayoffsAndStandingsShareText,
    buildPlayoffsShareBlock,
    buildStandingsShareBlock,
    formatTournamentShareHeader,
    type PlayoffMatchShareRow,
    extractMatchGameScores,
  } from '@/lib/tournament-share-text';
  import { PlayoffBracket } from '@/components/playoff-bracket';
  import { sortPlayerStandings } from '@/lib/standings-tiebreaker';
  import { PlayoffReseedDialog, ReseedSurvivor } from '@/components/playoff-reseed-dialog';
  import {
    buildReseededRoundMatches,
    findPendingReseedRound,
    getNextPlayoffRound,
  getReseedSurvivorIds,
  sortSurvivorsByOriginalSeed,
} from '@/lib/playoff-reseeding';
  import { TournamentIndividualSettingsForm } from '@/components/tournament-individual-settings-form';
  
  interface KingOfTheHillPlayer {
    id: string;
    tournament_id: string;
    player_name: string;
    player_user_id: string | null;
    dupr_id: string | null;
    dupr_rating: number | null;
    created_at: string;
  }
  
  interface KingOfTheHillMatch {
    id: string;
    tournament_id: string;
    round_number: number;
    match_number: number;
    team1_id: string | null;
    team2_id: string | null;
    player1_id: string | null;
    player2_id: string | null;
    player3_id: string | null;
    player4_id: string | null;
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
    team1_score: number | null;
    team2_score: number | null;
    team1_games_won: number | null;
    team2_games_won: number | null;
    winner_team_id: string | null;
    status: 'scheduled' | 'in_progress' | 'completed';
    match_status?: 'pending' | 'in_progress' | 'completed';
    current_game?: number;
    is_score_confirmed?: boolean;
    score_submitted_by?: string | null;
    completed_at: string | null;
  }
  
  interface PlayerStanding {
    player_id: string;
    player_name: string;
    dupr_rating: number | null;
    matches_played: number;
    matches_won: number;
    matches_lost: number;
    games_won: number;
    games_lost: number;
    points_for: number;
    points_against: number;
    point_differential: number;
  }
  
  interface KingOfTheHillPageProps {
    tournament: Tournament;
    isCreator: boolean;
    currentUserId: string | null;
    canSyncToDupr?: boolean;
    onBack: () => void;
    onTournamentUpdate?: () => Promise<void>;
  }

  export function KingOfTheHillPage({ tournament, isCreator, currentUserId, canSyncToDupr = false, onBack, onTournamentUpdate }: KingOfTheHillPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [players, setPlayers] = useState<KingOfTheHillPlayer[]>([]);
    const [matches, setMatches] = useState<KingOfTheHillMatch[]>([]);
    const [standings, setStandings] = useState<PlayerStanding[]>([]);
    const [loading, setLoading] = useState(true);
    const [showJoinDialog, setShowJoinDialog] = useState(false);
    const [joinName, setJoinName] = useState('');
    const [joiningSession, setJoiningSession] = useState(false);
    const [generatingSchedule, setGeneratingSchedule] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<KingOfTheHillMatch | null>(null);
    const [showScoreDialog, setShowScoreDialog] = useState(false);
    const [gameScores, setGameScores] = useState<{[key: string]: {team1: string; team2: string}}>({});
    const [activeTab, setActiveTab] = useState('players');
    const [copied, setCopied] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
    const [sharePlayoffsCopied, setSharePlayoffsCopied] = useState(false);
    const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
    const [manualPlayerName, setManualPlayerName] = useState('');
    const [addingManualPlayer, setAddingManualPlayer] = useState(false);
    const [syncingToDupr, setSyncingToDupr] = useState(false);
    const [showDeleteTournament, setShowDeleteTournament] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showUnifiedPlayerDialog, setShowUnifiedPlayerDialog] = useState(false);
    const [playerDialogTab, setPlayerDialogTab] = useState<'join' | 'add'>('join');
    const [localGameScores, setLocalGameScores] = useState<Record<number, { team1: string; team2: string }>>({});
    const [submittingScores, setSubmittingScores] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareLinkCopied, setShareLinkCopied] = useState(false);
    const [currentUserDuprId, setCurrentUserDuprId] = useState<string | null>(null);
    const [currentUserDuprRating, setCurrentUserDuprRating] = useState<number | null>(null);
    const [currentUserHasRequiredSub, setCurrentUserHasRequiredSub] = useState<boolean | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState<KingOfTheHillMatch | null>(null);
    const [deletingMatch, setDeletingMatch] = useState(false);
    const [doublesTeams, setDoublesTeams] = useState<any[]>([]);
    const [confirmingScore, setConfirmingScore] = useState(false);
    const [playoffMatches, setPlayoffMatches] = useState<TournamentMatch[]>([]);
    const [startingPlayoffs, setStartingPlayoffs] = useState(false);
    const [tournamentTeams, setTournamentTeams] = useState<TournamentTeam[]>([]);
    const [reseedDialogOpen, setReseedDialogOpen] = useState(false);
    const [reseedFromRound, setReseedFromRound] = useState<string | null>(null);
    const [reseedSurvivors, setReseedSurvivors] = useState<ReseedSurvivor[]>([]);
    const [generatingReseedRound, setGeneratingReseedRound] = useState(false);
    const [reseedDialogDismissedForRound, setReseedDialogDismissedForRound] = useState<string | null>(null);
    const [scheduleView, setScheduleView] = useState<'rounds' | 'teams'>('rounds');
    const [selectedScheduleTeamId, setSelectedScheduleTeamId] = useState('');
  
    useEffect(() => {
      loadData();
    }, [tournament.id]);
  
    // Removed auto-switch to standings tab - let users stay on current tab after score submission
  
    const determineDefaultRound = (matchesByRound: Record<string, KingOfTheHillMatch[]>, sortedRounds: string[]): string => {
      if (sortedRounds.length === 0) return '';
  
      let targetRound = sortedRounds[0];
      let maxRoundWithIncompleteScores = -1;
  
      for (const round of sortedRounds) {
        const roundMatches = matchesByRound[round];
        const totalMatches = roundMatches.length;
        let matchesWithScores = 0;
        let completedMatches = 0;
  
        for (const match of roundMatches) {
          if (match.status === 'completed') {
            completedMatches++;
          }
  
          const hasScores = match.game1_team1_points !== null ||
                           match.game1_team2_points !== null ||
                           match.game2_team1_points !== null ||
                           match.game2_team2_points !== null ||
                           match.game3_team1_points !== null ||
                           match.game3_team2_points !== null ||
                           match.game4_team1_points !== null ||
                           match.game4_team2_points !== null ||
                           match.game5_team1_points !== null ||
                           match.game5_team2_points !== null;
  
          if (hasScores) {
            matchesWithScores++;
          }
        }
  
        const roundNumber = parseInt(round.replace(/\D/g, '')) || 0;
  
        if (matchesWithScores > 0 && completedMatches < totalMatches) {
          if (roundNumber > maxRoundWithIncompleteScores) {
            maxRoundWithIncompleteScores = roundNumber;
            targetRound = round;
          }
        }
      }
  
      if (maxRoundWithIncompleteScores === -1) {
        for (let i = sortedRounds.length - 1; i >= 0; i--) {
          const round = sortedRounds[i];
          const roundMatches = matchesByRound[round];
          const hasAnyScores = roundMatches.some(match =>
            match.game1_team1_points !== null ||
            match.game1_team2_points !== null ||
            match.status === 'completed'
          );
  
          if (hasAnyScores) {
            return round;
          }
        }
      }
  
      return targetRound;
    };
  
    const loadData = async () => {
      try {
        setLoading(true);
        const playersData = await loadPlayers();
        await loadMatches(playersData);
        await loadPlayoffMatches();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
  
    const loadPlayers = async (): Promise<KingOfTheHillPlayer[]> => {
      const { data } = await supabase
        .from('tournament_teams')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('created_at', { ascending: true });
  
      let playersList: KingOfTheHillPlayer[] = [];
      if (data) {
        setTournamentTeams(data as TournamentTeam[]);
        if (tournament.team_format === 'doubles') {
          setDoublesTeams(data);
        }
        data.forEach(team => {
          if (team?.player1_name) {
            playersList.push({
              id: `${team.id}-p1`,
              tournament_id: tournament.id,
              player_name: team?.player1_name,
              player_user_id: team?.player1_user_id,
              dupr_id: team?.player1_dupr_id,
              dupr_rating: team?.player1_rating,
              created_at: team.created_at,
            });
          }
          if (team?.player2_name && tournament.team_format === 'doubles') {
            playersList.push({
              id: `${team.id}-p2`,
              tournament_id: tournament.id,
              player_name: team?.player2_name,
              player_user_id: team?.player2_user_id,
              dupr_id: team?.player2_dupr_id,
              dupr_rating: team?.player2_rating,
              created_at: team.created_at,
            });
          }
        });
        setPlayers(playersList);
      }
      return playersList;
    };
  
    const loadMatches = async (playersData: KingOfTheHillPlayer[]) => {
      const { data } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('is_playoff_match', false)
        .order('round_number', { ascending: true })
        .order('match_number', { ascending: true });
  
      if (data) {
        setMatches(data as any);
        calculateStandings(data as any, playersData);
      }
    };
  
    const loadPlayoffMatches = async () => {
      const { data } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          team1:tournament_teams!tournament_matches_team1_id_fkey(*),
          team2:tournament_teams!tournament_matches_team2_id_fkey(*)
        `)
        .eq('tournament_id', tournament.id)
        .eq('is_playoff_match', true)
        .order('bracket_position', { ascending: true });

      if (data) {
        setPlayoffMatches(data as unknown as TournamentMatch[]);
      }
    };

    const calculateStandings = (matchesList: KingOfTheHillMatch[], playersList: KingOfTheHillPlayer[]) => {
      const statsMap = new Map<string, PlayerStanding>();
  
      // Initialize all players
      playersList.forEach(player => {
        statsMap.set(player.id, {
          player_id: player.id,
          player_name: player?.player_name,
          dupr_rating: player.dupr_rating,
          matches_played: 0,
          matches_won: 0,
          matches_lost: 0,
          games_won: 0,
          games_lost: 0,
          points_for: 0,
          points_against: 0,
          point_differential: 0,
        });
      });
  
      // Process completed and in-progress matches (any match with at least one game scored)
      matchesList
        .filter(m => m.status === 'completed' || m.status === 'in_progress')
        .forEach(match => {
          let team1PlayerIds: string[] = [];
          let team2PlayerIds: string[] = [];
  
          // For Round Robin Individual doubles, use individual player IDs if available
          if ((match as any)?.player1_id || (match as any)?.player2_id ||
              (match as any)?.player3_id || (match as any)?.player4_id) {
            // Get player IDs from the individual player columns
            const player1Id = (match as any)?.player1_id;
            const player2Id = (match as any)?.player2_id;
            const player3Id = (match as any)?.player3_id;
            const player4Id = (match as any)?.player4_id;
  
            const findPlayer = (matchPlayerId: string) =>
              playersList.find(
                p => p.id.startsWith(matchPlayerId + '-') || p.player_user_id === matchPlayerId
              );
  
            if (player1Id) {
              const player = findPlayer(player1Id);
              if (player) team1PlayerIds.push(player.id);
            }
            if (player2Id) {
              const player = findPlayer(player2Id);
              if (player) team1PlayerIds.push(player.id);
            }
            if (player3Id) {
              const player = findPlayer(player3Id);
              if (player) team2PlayerIds.push(player.id);
            }
            if (player4Id) {
              const player = findPlayer(player4Id);
              if (player) team2PlayerIds.push(player.id);
            }
          } else {
            // Fallback to team-based lookup for backwards compatibility
            team1PlayerIds = playersList
              .filter(p => p.id.startsWith(match?.team1_id + '-'))
              .map(p => p.id);
            team2PlayerIds = playersList
              .filter(p => p.id.startsWith(match?.team2_id + '-'))
              .map(p => p.id);
          }
  
          // Calculate games won for each team
          let team1GamesWon = 0;
          let team2GamesWon = 0;
          let team1TotalPoints = 0;
          let team2TotalPoints = 0;
  
          for (let i = 1; i <= tournament.best_of; i++) {
            const team1Points = (match as any)[`game${i}_team1_points`];
            const team2Points = (match as any)[`game${i}_team2_points`];
  
            if (team1Points != null && team2Points != null) {
              team1TotalPoints += team1Points;
              team2TotalPoints += team2Points;
              if (team1Points > team2Points) team1GamesWon++;
              else if (team2Points > team1Points) team2GamesWon++;
            }
          }
  
          const matchWinner = team1GamesWon > team2GamesWon ? 'team1' : 'team2';
  
          // Update stats for team 1 players
          team1PlayerIds.forEach(playerId => {
            if (playerId && statsMap.has(playerId)) {
              const stats = statsMap.get(playerId)!;
              stats.matches_played++;
              stats.games_won += team1GamesWon;
              stats.games_lost += team2GamesWon;
              stats.points_for += team1TotalPoints;
              stats.points_against += team2TotalPoints;
              stats.point_differential += (team1TotalPoints - team2TotalPoints);
              if (matchWinner === 'team1') stats.matches_won++;
              else stats.matches_lost++;
            }
          });
  
          // Update stats for team 2 players
          team2PlayerIds.forEach(playerId => {
            if (playerId && statsMap.has(playerId)) {
              const stats = statsMap.get(playerId)!;
              stats.matches_played++;
              stats.games_won += team2GamesWon;
              stats.games_lost += team1GamesWon;
              stats.points_for += team2TotalPoints;
              stats.points_against += team1TotalPoints;
              stats.point_differential += (team2TotalPoints - team1TotalPoints);
              if (matchWinner === 'team2') stats.matches_won++;
              else stats.matches_lost++;
            }
          });
        });
  
      const standingsList = sortPlayerStandings(
        Array.from(statsMap.values()),
        matchesList,
        tournament.tiebreaker_point_differential_first ?? false
      );

      setStandings(standingsList);
    };
  
    const handleJoinSession = async () => {
      try {
        setJoiningSession(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
  
        // Check if user already joined
        const alreadyJoined = players.some(p => p?.player_user_id === session.user.id);
        if (alreadyJoined) {
          toast({
            title: 'Already registered',
            description: 'You have already joined this tournament.',
            variant: 'destructive',
          });
          return;
        }
  
        // Check if tournament is full using registered_players_count
        const capacity = tournament?.player_capacity || tournament.expected_teams || 0;
        const currentCount = tournament.registered_players_count || players.length;
        if (currentCount >= capacity) {
          toast({
            title: 'Tournament full',
            description: 'This tournament has reached its player capacity.',
            variant: 'destructive',
          });
          return;
        }
  
        const { data: profile } = await supabase
          .from('profiles')
          .select('dupr_id, dupr_rating, full_name, display_name')
          .eq('id', session.user.id)
          .maybeSingle();
  
        if (tournament.is_dupr_required && !profile?.dupr_id) {
          toast({
            title: 'DUPR sign-in required',
            description: 'Please sign in with DUPR to join. This tournament requires DUPR authentication.',
            variant: 'destructive',
          });
          return;
        }
  
        if (
          tournament.dupr_plus_required_subs &&
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
            const friendlyTiers = tournament.dupr_plus_required_subs.filter(t => t !== 'BASIC_L1').map(t => tierLabels[t] ?? t);
            toast({
              title: 'DUPR+ subscription required',
              description: `This tournament requires a DUPR ${friendlyTiers.join(' or ')} subscription to join.`,
              variant: 'destructive',
            });
            return;
          }
        }
  
        const displayName = getDisplayName({
          display_name: profile?.display_name,
          full_name: profile?.full_name,
          email: session.user.email
        }, 'Anonymous Player');
  
        // Pre-fill the name in the dialog
        setJoinName(displayName);
  
        if (tournament.is_dupr_required) {
          await addPlayer(displayName, session.user.id, profile?.dupr_id, profile?.dupr_rating);
        } else {
          setShowJoinDialog(true);
        }
      } finally {
        setJoiningSession(false);
      }
    };
  
    const addPlayer = async (playerName: string, userId: string | null = null, duprId: string | null = null, rating: number | null = null) => {
      try {
        const { data: existingTeams } = await supabase
          .from('tournament_teams')
          .select('team_number')
          .eq('tournament_id', tournament.id)
          .order('team_number', { ascending: false })
          .limit(1);
  
        const nextTeamNumber = existingTeams && existingTeams.length > 0
          ? existingTeams[0].team_number + 1
          : 1;
  
        const { error } = await supabase
          .from('tournament_teams')
          .insert({
            tournament_id: tournament.id,
            team_number: nextTeamNumber,
            player1_name: playerName,
            player1_user_id: userId,
            player1_dupr_id: duprId,
            player1_rating: rating,
            claimed_by_user_id: userId,
          });
  
        if (error) throw error;
  
        setShowJoinDialog(false);
        setJoinName('');
        const playersData = await loadPlayers();
        // Reload matches if they exist to recalculate standings
        if (matches.length > 0) {
          await loadMatches(playersData);
        }
        // Refresh tournament data to update registered_players_count
        if (onTournamentUpdate) {
          await onTournamentUpdate();
        }
        toast({ title: 'Joined successfully!' });
      } catch (error: any) {
        console.error('Error adding player:', error);
        const errorMessage = error?.message || 'Failed to join';
        const isCodeP0001 = error?.code === 'P0001';
        toast({
          title: isCodeP0001 ? 'DUPR Required' : 'Failed to join',
          description: isCodeP0001 ? 'You must have a verified DUPR account to join this tournament. Please sign in with DUPR first.' : errorMessage,
          variant: 'destructive'
        });
      }
    };
  
    const handleAddManualPlayer = async () => {
      if (tournament.is_dupr_required) {
        toast({
          title: 'DUPR required',
          description: 'Cannot add manual players to DUPR-required tournaments. Players must have DUPR accounts to join.',
          variant: 'destructive',
        });
        return;
      }
  
      if (!manualPlayerName.trim()) {
        toast({
          title: 'Name required',
          description: 'Please enter a player name',
          variant: 'destructive',
        });
        return;
      }
  
      // Check if tournament is full using registered_players_count
      const capacity = tournament?.player_capacity || tournament.expected_teams || 0;
      const currentCount = tournament.registered_players_count || players.length;
      if (currentCount >= capacity) {
        toast({
          title: 'Tournament full',
          description: 'This tournament has reached its player capacity.',
          variant: 'destructive',
        });
        return;
      }
  
      // Check for duplicate names
      const nameExists = players.some(
        p => p?.player_name.toLowerCase() === manualPlayerName.trim().toLowerCase()
      );
      if (nameExists) {
        toast({
          title: 'Name already exists',
          description: 'A player with this name is already registered',
          variant: 'destructive',
        });
        return;
      }
  
      try {
        setAddingManualPlayer(true);
        await addPlayer(manualPlayerName.trim(), null, null, null);
        setShowAddPlayerDialog(false);
        setManualPlayerName('');
        toast({ title: 'Player added successfully!' });
      } catch (error) {
        console.error('Error adding manual player:', error);
        toast({ title: 'Failed to add player', variant: 'destructive' });
      } finally {
        setAddingManualPlayer(false);
      }
    };
  
    const copyShareLink = async () => {
      try {
        const shareUrl = `${window.location.origin}/dashboard/tournaments/${tournament.id}`;
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
  
    const removePlayer = async (playerId: string) => {
      if (!isCreator) return;
  
      try {
        // Extract team ID from player ID (format: teamId-p1 or teamId-p2)
        const teamId = playerId.slice(0, -3); // Remove last 3 chars (-p1 or -p2)
  
        // Delete the entire team record
        const { error } = await supabase
          .from('tournament_teams')
          .delete()
          .eq('id', teamId);
  
        if (error) throw error;
  
        const playersData = await loadPlayers();
        // Reload matches if they exist to recalculate standings
        if (matches.length > 0) {
          await loadMatches(playersData);
        }
        // Refresh tournament data to update registered_players_count
        if (onTournamentUpdate) {
          await onTournamentUpdate();
        }
        toast({ title: 'Player removed' });
      } catch (error) {
        console.error('Error removing player:', error);
        toast({ title: 'Failed to remove player', variant: 'destructive' });
      }
    };
  
    const generateSchedule = async (options?: { softDeleteUnlockedFirst?: boolean }) => {
      if (players.length < 2) {
        toast({
          title: 'Not enough players',
          description: 'Need at least 2 players to generate a schedule',
          variant: 'destructive',
        });
        return;
      }
  
      try {
        setGeneratingSchedule(true);

        if (options?.softDeleteUnlockedFirst) {
          const unlockedIds = matches
            .filter((m) => {
              const locked =
                m.status === 'completed' ||
                m.status === 'in_progress' ||
                m.game1_team1_points != null ||
                m.game1_team2_points != null;
              return !locked;
            })
            .map((m) => m.id);
          if (unlockedIds.length > 0) {
            const { error: delErr } = await supabase
              .from('tournament_matches')
              .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId })
              .in('id', unlockedIds);
            if (delErr) throw delErr;
          }
        }

        const lockedMatches = matches.filter(
          (m) =>
            m.status === 'completed' ||
            m.status === 'in_progress' ||
            m.game1_team1_points != null ||
            m.game1_team2_points != null,
        );
        const maxLockedRound = lockedMatches.reduce((max, m) => {
          const n = parseInt(String(m.round_number || '').replace(/\D/g, ''), 10) || 0;
          return Math.max(max, n);
        }, 0);
        const playedPairKeys = new Set(
          lockedMatches
            .filter((m) => m.team1_id && m.team2_id)
            .map((m) => {
              const a = m.team1_id!;
              const b = m.team2_id!;
              return a < b ? `${a}::${b}` : `${b}::${a}`;
            }),
        );
  
        const playersList: Player[] = players.map(p => ({
          user_id: p?.player_user_id,
          player_name: p?.player_name,
          dupr_id: p.dupr_id || undefined,
          dupr_rating: p.dupr_rating || undefined,
          session_player_id: p.id.slice(0, -3),
        }));
  
        let matchesToCreate: any[] = [];
  
        if (tournament.team_format === 'singles') {
          const singlesMatchups = generateSinglesSchedule(playersList);
  
          matchesToCreate = singlesMatchups
            .map((matchup, index) => {
              const a = matchup?.player_a?.session_player_id || null;
              const b = matchup?.player_b?.session_player_id || null;
              if (a && b) {
                const key = a < b ? `${a}::${b}` : `${b}::${a}`;
                if (playedPairKeys.has(key)) return null;
              }
              const roundNumber =
                options?.softDeleteUnlockedFirst && maxLockedRound > 0
                  ? maxLockedRound + matchup.round_number
                  : matchup.round_number;
              return {
                tournament_id: tournament.id,
                round: `Round ${roundNumber}`,
                round_number: roundNumber,
                match_number: index + 1,
                team1_id: a,
                team2_id: b,
                player1_id: a,
                player3_id: b,
                status: 'scheduled',
                is_playoff_match: false,
              };
            })
            .filter(Boolean);
        } else {
          const doublesMatchups = generateDoublesSchedule(playersList);
  
          if (doublesMatchups.length === 0) {
            toast({
              title: 'Not enough players',
              description: 'Need at least 4 players to generate a doubles schedule',
              variant: 'destructive',
            });
            return;
          }
  
          matchesToCreate = doublesMatchups
            .map((matchup, index) => {
              const a = matchup.team1_player1?.session_player_id || null;
              const b = matchup.team2_player1?.session_player_id || null;
              if (a && b) {
                const key = a < b ? `${a}::${b}` : `${b}::${a}`;
                if (playedPairKeys.has(key)) return null;
              }
              const roundNumber =
                options?.softDeleteUnlockedFirst && maxLockedRound > 0
                  ? maxLockedRound + matchup.round_number
                  : matchup.round_number;
              return {
                tournament_id: tournament.id,
                round: `Round ${roundNumber}`,
                round_number: roundNumber,
                match_number: index + 1,
                team1_id: a,
                team2_id: b,
                player1_id: matchup.team1_player1?.session_player_id || null,
                player2_id: matchup.team1_player2?.session_player_id || null,
                player3_id: matchup.team2_player1?.session_player_id || null,
                player4_id: matchup.team2_player2?.session_player_id || null,
                status: 'scheduled',
                is_playoff_match: false,
              };
            })
            .filter(Boolean);
        }
  
        if (matchesToCreate.length === 0) {
          toast({
            title: 'Nothing to schedule',
            description: 'All required matchups are already completed.',
          });
          return;
        }

        const { error } = await supabase
          .from('tournament_matches')
          .insert(matchesToCreate);
  
        if (error) throw error;
  
        const playersData = await loadPlayers();
        await loadMatches(playersData);
        setActiveTab('matchups');
        toast({
          title: options?.softDeleteUnlockedFirst ? 'Schedule rebuilt!' : 'Schedule generated!',
          description: options?.softDeleteUnlockedFirst
            ? 'Completed games were kept; remaining matchups were realigned.'
            : undefined,
        });
      } catch (error) {
        console.error('Error generating schedule:', error);
        toast({ title: 'Failed to generate schedule', variant: 'destructive' });
      } finally {
        setGeneratingSchedule(false);
      }
    };
  
    const isParticipantInMatch = (match: KingOfTheHillMatch): boolean => {
      if (!currentUserId) return false;
      const currentPlayer = players.find(p => p.player_user_id === currentUserId);
      const teamId = currentPlayer ? currentPlayer.id.slice(0, -3) : null;
      if (!teamId) return false;

      // Singles/doubles: participants stored as team1_id / team2_id
      if (match?.team1_id === teamId || match?.team2_id === teamId) return true;

      // KoH rotating format: participants stored as player1_id..player4_id
      return (
        match?.player1_id === teamId ||
        match?.player2_id === teamId ||
        match?.player3_id === teamId ||
        match?.player4_id === teamId
      );
    };
  
    const canUserEnterScore = (match: KingOfTheHillMatch): boolean => {
      if (!currentUserId) return false;
      return isCreator || canSyncToDupr || isParticipantInMatch(match);
    };
  
    const canUserConfirmScore = (): boolean => {
      return canSyncToDupr;
    };
  
    const openScoreDialog = (match: KingOfTheHillMatch) => {
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
      for (let i = 1; i <= tournament.best_of; i++) {
        const t1 = (match as any)[`game${i}_team1_points`];
        const t2 = (match as any)[`game${i}_team2_points`];
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
      if (!selectedMatch) return;
  
      try {
        setSubmittingScores(true);
  
        const gamesToSubmit: Array<{ gameNum: number; team1: number; team2: number }> = [];
        const bestOf = tournament.best_of;
  
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

        const isPlayoffMatch = !!(selectedMatch as any).is_playoff_match;

        if (isPlayoffMatch) {
          await loadPlayoffMatches();
          if (matchDecided) {
            const { data: updatedMatch } = await supabase
              .from('tournament_matches')
              .select('winner_team_id')
              .eq('id', selectedMatch.id)
              .maybeSingle();
            if (updatedMatch?.winner_team_id) {
              await advancePlayoffBracket(selectedMatch, updatedMatch.winner_team_id);
            }
          }
        } else {
          const playersData = await loadPlayers();
          await loadMatches(playersData);
        }

        const player1Name = players.find(p => p.id === selectedMatch?.player1_id)?.player_name || 'Team 1';
        const player2Name = players.find(p => p.id === selectedMatch?.player2_id)?.player_name || 'Team 2';

        toast({
          title: matchDecided ? 'Scores Submitted — Pending Confirmation' : 'Scores Saved — Pending Confirmation',
          description: matchDecided
            ? `${team1GamesWon > team2GamesWon ? player1Name : player2Name} wins ${Math.max(team1GamesWon, team2GamesWon)}-${Math.min(team1GamesWon, team2GamesWon)}. ${canUserConfirmScore() ? 'Use "Confirm Scores" to finalize.' : 'Awaiting confirmation by the organizer.'}`
            : `${gamesToSubmit.length} game${gamesToSubmit.length > 1 ? 's' : ''} recorded. Series: ${team1GamesWon}-${team2GamesWon}. Awaiting confirmation.`,
          variant: 'default'
        });

        setShowScoreDialog(false);

        if (matchDecided && !isPlayoffMatch) {
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

    const submitGameScore = async (gameNumber: number, team1Points: number, team2Points: number) => {
      if (!selectedMatch) return;
  
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
  
        // Reload data
        const playersData = await loadPlayers();
        await loadMatches(playersData);
  
        // Get player names for display
        const player1Name = players.find(p => p.id === selectedMatch?.player1_id)?.player_name || 'Team 1';
        const player2Name = players.find(p => p.id === selectedMatch?.player2_id)?.player_name || 'Team 2';
  
        toast({
          title: matchDecided ? 'Match Complete!' : 'Game Score Saved',
          description: matchDecided
            ? `${team1GamesWon > team2GamesWon ? player1Name : player2Name} wins ${Math.max(team1GamesWon, team2GamesWon)}-${Math.min(team1GamesWon, team2GamesWon)}`
            : `Game ${gameNumber} recorded. Series: ${team1GamesWon}-${team2GamesWon}`,
          variant: 'default'
        });
  
        // Close dialog if match is complete
        if (matchDecided) {
          setShowScoreDialog(false);
        }
      } catch (error) {
        console.error('Error submitting game score:', error);
        throw error;
      }
    };
  
    const syncToDupr = async () => {
      try {
        setSyncingToDupr(true);
  
        const completedMatches = [
          ...matches.filter(m => m.status === 'completed'),
          ...playoffMatches.filter(m => m.status === 'completed'),
        ];
        // if (completedMatches.length === 0) {
        //   toast({
        //     title: 'No matches to sync',
        //     description: 'There are no completed matches to sync to DUPR.',
        //     variant: 'default'
        //   });
        //   return;
        // }
  
        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-create-club-match`;
        const { data: { session: authSession } } = await supabase.auth.getSession();
  
        let syncedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
  
        for (const match of matches) {
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
          const playersData = await loadPlayers();
          await loadMatches(playersData);
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
  
    const confirmMatchScore = async (match: KingOfTheHillMatch) => {
      if (!canUserConfirmScore()) return;
      try {
        setConfirmingScore(true);
        const { error } = await supabase
          .from('tournament_matches')
          .update({ is_score_confirmed: true })
          .eq('id', match.id);
        if (error) throw error;
        const playersData = await loadPlayers();
        await loadMatches(playersData);
        setSelectedMatch(prev => prev?.id === match.id ? { ...prev, is_score_confirmed: true } : prev);
        toast({ title: 'Scores Confirmed', description: 'Match scores have been confirmed.', variant: 'default' });
      } catch (error) {
        console.error('Error confirming scores:', error);
        toast({ title: 'Error', description: 'Failed to confirm scores. Please try again.', variant: 'destructive' });
      } finally {
        setConfirmingScore(false);
      }
    };
  
    const getKothTeamLabel = (teamId: string) => {
      const teamPlayers = players.filter((player) => player.id.startsWith(teamId));
      if (teamPlayers.length > 0) {
        return teamPlayers.map((player) => player.player_name).join(' & ');
      }
      const team = tournamentTeams.find((entry) => entry.id === teamId);
      if (!team) return 'Unknown';
      const playerOne = team.player1_name || 'Player 1';
      return team.player2_name ? `${playerOne} / ${team.player2_name}` : playerOne;
    };

    const openReseedDialogForRound = (fromRound: string) => {
      const survivorIds = sortSurvivorsByOriginalSeed(
        getReseedSurvivorIds(playoffMatches, fromRound),
        tournamentTeams
      );

      setReseedFromRound(fromRound);
      setReseedSurvivors(
        survivorIds.map((teamId) => ({
          teamId,
          label: getKothTeamLabel(teamId),
          originalSeed: tournamentTeams.find((team) => team.id === teamId)?.playoff_seed ?? null,
        }))
      );
      setReseedDialogOpen(true);
    };

    const handleReseedDialogOpenChange = (open: boolean) => {
      setReseedDialogOpen(open);
      if (!open && reseedFromRound) {
        setReseedDialogDismissedForRound(reseedFromRound);
      }
    };

    const generateReseededRound = async (orderedTeamIds: string[]) => {
      if (!reseedFromRound) return;

      try {
        setGeneratingReseedRound(true);
        const nextRound = getNextPlayoffRound(reseedFromRound);
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

        if (payloads.length === 0) {
          toast({
            title: 'Unable to generate round',
            description: 'Not enough remaining players to create the next round.',
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase.from('tournament_matches').insert(payloads);
        if (error) throw error;

        await loadPlayoffMatches();
        setReseedDialogOpen(false);
        setReseedFromRound(null);
        setReseedSurvivors([]);
        setReseedDialogDismissedForRound(null);

        toast({
          title: `${nextRound} created`,
          description: 'Next playoff round has been generated from your seeding.',
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
      if (!tournament.playoff_reseeding || !isCreator || reseedDialogOpen) return;

      const pendingRound = findPendingReseedRound(playoffMatches, true);
      if (pendingRound && pendingRound !== reseedDialogDismissedForRound) {
        openReseedDialogForRound(pendingRound);
      }
    }, [playoffMatches, tournament.playoff_reseeding, isCreator, reseedDialogOpen, reseedDialogDismissedForRound]);

    const advancePlayoffBracket = async (completedMatch: KingOfTheHillMatch, winnerId: string) => {
      if ((completedMatch as any).playoff_round === 'Finals') {
        await supabase.from('tournaments').update({ champion_team_id: winnerId }).eq('id', tournament.id);
        if (onTournamentUpdate) await onTournamentUpdate();
        return;
      }

      const rounds: Record<string, string> = {
        'Round of 16': 'Quarterfinals',
        'Quarterfinals': 'Semifinals',
        'Semifinals': 'Finals',
        'First Round': 'Finals',
      };

      const nextRound = rounds[(completedMatch as any).playoff_round || ''];
      if (!nextRound) return;

      if (tournament.playoff_reseeding) {
        await loadPlayoffMatches();
        return;
      }

      const { data: currentRoundMatches } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('is_playoff_match', true)
        .eq('playoff_round', (completedMatch as any).playoff_round)
        .is('deleted_at', null);

      if (!currentRoundMatches) return;

      const pos = (completedMatch as any).bracket_position ?? 0;
      const pairedPos = pos % 2 === 1 ? pos + 1 : pos - 1;
      const pairedMatch = currentRoundMatches.find((m: any) => m.bracket_position === pairedPos);

      if (!pairedMatch || pairedMatch.status !== 'completed' || !pairedMatch.winner_team_id) return;

      const nextBracketPosition = Math.ceil(Math.min(pos, pairedPos) / 2);
      const { data: existing } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('is_playoff_match', true)
        .eq('playoff_round', nextRound)
        .eq('bracket_position', nextBracketPosition)
        .maybeSingle();

      if (existing) return;

      const lowerPosWinner = pos < pairedPos ? winnerId : pairedMatch.winner_team_id;
      const higherPosWinner = pos < pairedPos ? pairedMatch.winner_team_id : winnerId;

      const { data: maxMatch } = await supabase
        .from('tournament_matches')
        .select('match_number')
        .eq('tournament_id', tournament.id)
        .order('match_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from('tournament_matches').insert({
        tournament_id: tournament.id,
        match_number: ((maxMatch as any)?.match_number ?? 1000) + 1,
        round: nextRound,
        team1_id: lowerPosWinner,
        team2_id: higherPosWinner,
        status: 'scheduled',
        is_playoff_match: true,
        playoff_round: nextRound,
        bracket_position: nextBracketPosition,
      });

      await loadPlayoffMatches();
    };

    const startPlayoffs = async () => {
      if (!tournament.has_playoffs) return;
      try {
        setStartingPlayoffs(true);

        const qualifierCount = tournament.playoff_qualifiers || 4;
        const topPlayers = sortPlayerStandings(
          [...standings],
          matches,
          tournament.tiebreaker_point_differential_first ?? false
        ).slice(0, qualifierCount);

        if (topPlayers.length < 2) {
          toast({
            title: 'Not enough data',
            description: 'Need at least 2 players with completed matches to start playoffs.',
            variant: 'destructive',
          });
          return;
        }

        // Resolve each player's team_id (strip the -p1/-p2 suffix)
        const teamIds = topPlayers.map(p => p.player_id.slice(0, -3));

        await Promise.all(
          teamIds.map((teamId, index) =>
            supabase
              .from('tournament_teams')
              .update({ playoff_seed: index + 1 })
              .eq('id', teamId)
          )
        );

        await loadPlayers();

        await supabase
          .from('tournaments')
          .update({ playoffs_started: true, playoffs_started_at: new Date().toISOString() })
          .eq('id', tournament.id);

        const rounds: Record<number, string> = { 2: 'Finals', 4: 'Semifinals', 8: 'Quarterfinals', 16: 'Round of 16' };
        const byeCount = tournament.playoff_byes || 0;
        const nextPow2 = Math.pow(2, Math.ceil(Math.log2(teamIds.length)));
        const roundName = rounds[nextPow2] || `Round of ${nextPow2}`;

        const playoffMatchesToCreate: any[] = [];
        let bracketPosition = 1;

        if (byeCount > 0) {
          const playingTeams = teamIds.slice(byeCount);
          const round1Name = rounds[Math.pow(2, Math.ceil(Math.log2(teamIds.length)))] || 'First Round';
          for (let i = 0; i < playingTeams.length; i += 2) {
            if (i + 1 < playingTeams.length) {
              playoffMatchesToCreate.push({
                tournament_id: tournament.id,
                match_number: 1000 + bracketPosition,
                round: round1Name,
                team1_id: playingTeams[i],
                team2_id: playingTeams[i + 1],
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
          for (let i = 0; i < teamIds.length; i += 2) {
            if (i + 1 < teamIds.length) {
              playoffMatchesToCreate.push({
                tournament_id: tournament.id,
                match_number: 1000 + bracketPosition,
                round: roundName,
                team1_id: teamIds[i],
                team2_id: teamIds[i + 1],
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

        const { error } = await supabase.from('tournament_matches').insert(playoffMatchesToCreate);
        if (error) throw error;

        await loadPlayoffMatches();
        if (onTournamentUpdate) await onTournamentUpdate();
        setActiveTab('playoffs');

        toast({ title: 'Playoffs started!', description: `Top ${topPlayers.length} players seeded into the bracket.` });
      } catch (error) {
        console.error('Error starting playoffs:', error);
        toast({ title: 'Failed to start playoffs', variant: 'destructive' });
      } finally {
        setStartingPlayoffs(false);
      }
    };

    const checkAndAutoStartPlayoffs = async () => {
      if (!tournament.has_playoffs) return;
      if (tournament.playoffs_started) return;

      const { data: remaining } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('is_playoff_match', false)
        .is('deleted_at', null)
        .neq('status', 'completed')
        .limit(1);

      if (!remaining || remaining.length > 0) return;

      toast({ title: 'All matches complete!', description: 'Starting playoffs automatically...' });
      await startPlayoffs();
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
  
    const canDeleteTournament = matches.length === 0;
  
    const handleDeleteMatch = async () => {
      if (!matchToDelete || !isCreator) return;
  
      try {
        setDeletingMatch(true);
  
        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-delete-match`;
        const { data: { session: authSession } } = await supabase.auth.getSession();
  
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession?.access_token}`,
          },
          body: JSON.stringify({ matchId: matchToDelete.id }),
        });
  
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to delete match');
        }
  
        toast({
          title: 'Match deleted',
          description: 'The match has been successfully removed.',
        });
  
        const playersData = await loadPlayers();
        await loadMatches(playersData);
      } catch (error: any) {
        console.error('Error deleting match:', error);
        toast({
          title: 'Failed to delete match',
          description: error.message || 'An error occurred while deleting the match.',
          variant: 'destructive',
        });
      } finally {
        setDeletingMatch(false);
        setShowDeleteDialog(false);
        setMatchToDelete(null);
      }
    };
  
    const getPlayerName = (playerId: string | null) => {
      if (!playerId) return 'Unknown';
      const player = players.find(p => p.id === playerId);
      return player?.player_name || 'Unknown';
    };
  
    const getTeamPlayers = (teamId: string | null) => {
      if (!teamId) return [];
      return players.filter(p => p.id.startsWith(teamId + '-'));
    };
  
    const getPlayerNameByTeamRowId = (teamRowId: string | null) => {
      if (!teamRowId) return null;
      const player = players.find(p => p.id.startsWith(teamRowId + '-'));
      return player?.player_name || null;
    };
  
    const getPlayerNameById = (playerId: string | null) => {
      if (!playerId) return null;
      const player = players.find(p => p.player_user_id === playerId || p.id.startsWith(playerId + '-'));
      return player?.player_name || null;
    };
  
    const formatMatchTeams = (match: KingOfTheHillMatch) => {
      const team1Players = getTeamPlayers(match?.team1_id);
      const team2Players = getTeamPlayers(match?.team2_id);
  
      if (team1Players.length > 0 || team2Players.length > 0) {
        if (tournament.team_format === 'singles') {
          return {
            team1: team1Players[0]?.player_name || 'Unknown',
            team2: team2Players[0]?.player_name || 'Unknown',
          };
        }
  
        const m = match as any;
  
        const team1Names = [...team1Players.map(p => p?.player_name)];
        if (team1Players.length < 2) {
          const team1MainId = team1Players[0]?.player_user_id || match?.team1_id;
          const p1id = m?.player1_id;
          const p2id = m?.player2_id;
          const team1PartnerRawId = (p1id === team1MainId || p1id === match?.team1_id) ? p2id : p1id;
          const partnerName = getPlayerNameById(team1PartnerRawId);
          if (partnerName) team1Names.push(partnerName);
        }
  
        const team2Names = [...team2Players.map(p => p?.player_name)];
        if (team2Players.length < 2) {
          const team2MainId = team2Players[0]?.player_user_id || match?.team2_id;
          const p3id = m?.player3_id;
          const p4id = m?.player4_id;
          const team2PartnerRawId = (p3id === team2MainId || p3id === match?.team2_id) ? p4id : p3id;
          const partnerName = getPlayerNameById(team2PartnerRawId);
          if (partnerName) team2Names.push(partnerName);
        }
  
        return {
          team1: team1Names.filter(Boolean).join(' & ') || 'Unknown',
          team2: team2Names.filter(Boolean).join(' & ') || 'Unknown',
        };
      }
  
      // Legacy: individual player IDs
      const p1 = getPlayerNameById((match as any)?.player1_id);
      const p2 = getPlayerNameById((match as any)?.player2_id);
      const p3 = getPlayerNameById((match as any)?.player3_id);
      const p4 = getPlayerNameById((match as any)?.player4_id);
      return {
        team1: [p1, p2].filter(Boolean).join(' & ') || 'Unknown',
        team2: [p3, p4].filter(Boolean).join(' & ') || 'Unknown',
      };
    };
  
    const handleShareStandings = async () => {
      if (standings.length === 0) {
        toast({
          title: "No standings",
          description: "No standings available to copy",
          variant: "destructive",
        });
        return;
      }
  
      try {
        const eventName = tournament.name?.trim() || "Round Robin";
  
        // Format only the start time
        const timeStr = tournament.start_time ? new Date(`2000-01-01T${tournament.start_time}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) : '';
  
        // Count completed and total games (rounds × best_of)
        const bestOf = tournament.best_of || 3;
  
        // Calculate total completed games across all matches
        let completedGamesCount = 0;
        matches.forEach(match => {
          if (match.status === 'completed') {
            // For completed matches, count actual games played
            const gamesPlayed = (match.team1_games_won || 0) + (match.team2_games_won || 0);
            completedGamesCount += gamesPlayed;
          }
        });
  
        // Total possible games = total matches × best_of
        const totalPossibleGames = matches.length * bestOf;
  
        // Build header
        let text = timeStr ? `${eventName} ${timeStr}\n\n` : `${eventName}\n\n`;
        text += `Standings (${completedGamesCount}/${totalPossibleGames})\n\n`;
  
        standings.forEach((s) => {
          const playerName = s?.player_name || 'Unknown Player';
          const w = s.games_won ?? 0;
          const l = s.games_lost ?? 0;
          const diff = s.point_differential ?? 0;
          const diffStr = diff >= 0 ? `+${diff}` : diff.toString();
  
          text += `${playerName}    ${w}-${l} ${diffStr}\n`;
        });
  
        const result = await copyToClipboard(text.trim());
  
        if (result.success) {
          setShareCopied(true);
          toast({
            title: "Standings copied",
            description: "Player standings ready to paste",
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

    const handleSharePlayoffs = async () => {
      if (standings.length === 0 && playoffMatches.length === 0) {
        toast({
          title: 'Nothing to share',
          description: 'No standings or playoff results available to copy',
          variant: 'destructive',
        });
        return;
      }

      try {
        const header = formatTournamentShareHeader(
          tournament.name,
          tournament.date,
          tournament.start_time,
        );

        const bestOf = tournament.best_of || 3;
        let completedGamesCount = 0;
        matches.forEach((match) => {
          if (match.status === 'completed') {
            completedGamesCount += (match.team1_games_won || 0) + (match.team2_games_won || 0);
          }
        });
        const totalPossibleGames = matches.length * bestOf;

        const standingsBlock = buildStandingsShareBlock(
          standings.map((s) => ({
            label: s.player_name || 'Unknown Player',
            wins: s.games_won ?? 0,
            losses: s.games_lost ?? 0,
            pointDifferential: s.point_differential ?? 0,
          })),
          completedGamesCount,
          totalPossibleGames,
        );

        const playoffRows: PlayoffMatchShareRow[] = playoffMatches.map((match) => {
          const teams = formatMatchTeams(match as unknown as KingOfTheHillMatch);
          return {
            playoffRound: match.playoff_round || 'Playoffs',
            team1Label: teams.team1,
            team2Label: teams.team2,
            seed1: match.seeding_position_team1,
            seed2: match.seeding_position_team2,
            status: match.status,
            gameScores: extractMatchGameScores(match as unknown as Record<string, unknown>, tournament.best_of || 3),
            team1GamesWon: match.team1_games_won,
            team2GamesWon: match.team2_games_won,
          };
        });

        let championLabel: string | null = null;
        if (tournament.champion_team_id) {
          const championPlayers = players.filter((p) =>
            p.id.startsWith(tournament.champion_team_id!),
          );
          championLabel = championPlayers.map((p) => p.player_name).join(' & ') || null;
        }

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
  
    const matchesByRound = matches.reduce((acc, match) => {
      const round = `Round ${match.round_number}`;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    }, {} as Record<string, KingOfTheHillMatch[]>);
  
    const sortedRounds = Object.keys(matchesByRound).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    const scheduleTeamIds = Array.from(new Set(
      matches
        .flatMap((match) => [match.team1_id, match.team2_id])
        .filter((teamId): teamId is string => Boolean(teamId))
    ));
    const scheduleTeamLabels = Object.fromEntries(
      scheduleTeamIds.map((teamId) => {
        const match = matches.find(
          (entry) => entry.team1_id === teamId || entry.team2_id === teamId
        );
        if (!match) return [teamId, 'Unknown'];
        const names = formatMatchTeams(match);
        return [teamId, match.team1_id === teamId ? names.team1 : names.team2];
      })
    );
    const activeScheduleTeamId = scheduleTeamIds.includes(selectedScheduleTeamId)
      ? selectedScheduleTeamId
      : scheduleTeamIds[0] || '';
    const activeScheduleTeamMatches = matches.filter(
      (match) => match.team1_id === activeScheduleTeamId || match.team2_id === activeScheduleTeamId
    );
  
    const userHasJoined = currentUserId && players.some(p => p?.player_user_id === currentUserId);
    const currentCount = tournament.registered_players_count || players.length;
    const capacity = tournament?.player_capacity || tournament.expected_teams || 0;
    const canJoin = currentUserId && !userHasJoined && currentCount < capacity;
    const showSettingsTab = isCreator;
    const tabsListClass = showSettingsTab
      ? (tournament.has_playoffs ? 'sm:grid-cols-5' : 'sm:grid-cols-4')
      : (tournament.has_playoffs ? 'sm:grid-cols-4' : 'sm:grid-cols-3');
  
    if (loading) {
      return (
        <div className="container p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      );
    }
  
    return (
      <div className="container py-8">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tournaments
        </Button>
  
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
                  {tournament.has_playoffs ? 'Round Robin + Playoffs' : 'Round Robin'}
                </Badge>
                {tournament.has_playoffs && tournament.playoff_qualifiers && (
                  <Badge variant="outline" className="text-gray-900 border-gray-300">{tournament.playoff_qualifiers} playoff spots</Badge>
                )}
                {tournament.best_of > 1 && (
                  <Badge variant="outline" className="text-gray-900 border-gray-300">Best of {tournament.best_of}</Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {(canJoin || (isCreator && matches.length === 0 && currentCount < (tournament?.player_capacity || tournament.expected_teams || 0))) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const tab = canJoin ? 'join' : 'add';
                    setPlayerDialogTab(tab);
  
                    if (tab === 'join' && currentUserId) {
                      const { data: profile } = await supabase
                        .from('profiles')
                        .select('display_name, full_name, dupr_id, dupr_singles_rating')
                        .eq('id', currentUserId)
                        .maybeSingle();
  
                      const { data: { session } } = await supabase.auth.getSession();
                      const displayName = getDisplayName({
                        display_name: profile?.display_name,
                        full_name: profile?.full_name,
                        email: session?.user?.email
                      }, 'Anonymous Player');
  
                      setJoinName(displayName);
                      const duprId = profile?.dupr_id || null;
                      setCurrentUserDuprId(duprId);
                      setCurrentUserDuprRating(profile?.dupr_singles_rating || null);
  
                      if (
                        tournament.dupr_plus_required_subs &&
                        tournament.dupr_plus_required_subs.length > 0
                      ) {
                        if (!duprId) {
                          setCurrentUserHasRequiredSub(false);
                        } else {
                          const { data: subCache } = await supabase
                            .from('dupr_subscriptions_cache')
                            .select('tournaments, expires_at')
                            .eq('dupr_id', duprId)
                            .maybeSingle();
                          if (!subCache || new Date(subCache.expires_at) < new Date()) {
                            setCurrentUserHasRequiredSub(false);
                          } else {
                            setCurrentUserHasRequiredSub(
                              tournament.dupr_plus_required_subs.some((r) => subCache.tournaments.includes(r))
                            );
                          }
                        }
                      } else {
                        setCurrentUserHasRequiredSub(null);
                      }
                    }
  
                    setShowUnifiedPlayerDialog(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {!isCreator  ? 'Join Tournament' : '+ Add Player'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareModal(true)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Share Link
              </Button>
              {(isCreator && canDeleteTournament) && (
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
          </div>
        </div>
  
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:flex-1">
            <ScrollableTabsList desktopClassName={tabsListClass}>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="matchups">Matchups</TabsTrigger>
              <TabsTrigger value="standings">Standings</TabsTrigger>
              {showSettingsTab && (
                <TabsTrigger value="settings">Settings</TabsTrigger>
              )}
              {tournament.has_playoffs && (
                <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
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
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="matchups">Matchups</TabsTrigger>
              <TabsTrigger value="standings">Standings</TabsTrigger>
              {showSettingsTab && (
                <TabsTrigger value="settings">Settings</TabsTrigger>
              )}
              {tournament.has_playoffs && (
                <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
              )}
            </TabsList>
          </div>
  
          <TabsContent value="players" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {tournament.team_format === 'doubles' && matches.length > 0 ? 'Teams' : 'Registered Players'}
                    </CardTitle>
                    <CardDescription>
                      {currentCount} of {capacity} players registered
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tournament.team_format === 'doubles' && matches.length > 0 ? (
                  doublesTeams.length > 0 ? (
                    <div className="grid gap-3">
                      {doublesTeams.map((team, index) => {
                        const isUserOnTeam = team.player1_user_id === currentUserId || team.player2_user_id === currentUserId;
                        return (
                          <div key={team.id} className={`border rounded-lg overflow-hidden ${isUserOnTeam ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                            <div className="flex items-center px-4 py-2 bg-muted/30 border-b">
                              <span className="font-semibold text-sm">Team {index + 1}</span>
                            </div>
                            <div className="divide-y">
                              <div className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{team.player1_name}</span>
                                  {!team.player1_user_id && <Badge variant="secondary" className="text-xs">Manual</Badge>}
                                  {team.player1_user_id === currentUserId && <Badge variant="outline" className="text-xs text-green-600">You</Badge>}
                                </div>
                                {team.player1_rating && (
                                  <Badge variant="outline" className="text-xs">{team.player1_rating} DUPR</Badge>
                                )}
                              </div>
                              {team.player2_name && (
                                <div className="flex items-center justify-between px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{team.player2_name}</span>
                                    {!team.player2_user_id && <Badge variant="secondary" className="text-xs">Manual</Badge>}
                                    {team.player2_user_id === currentUserId && <Badge variant="outline" className="text-xs text-green-600">You</Badge>}
                                  </div>
                                  {team.player2_rating && (
                                    <Badge variant="outline" className="text-xs">{team.player2_rating} DUPR</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No teams registered yet.
                    </div>
                  )
                ) : (
                  players.length > 0 ? (
                    <div className="grid gap-3">
                      {players.map((player, index) => (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="font-bold text-lg w-8">#{index + 1}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{player?.player_name}</span>
                                {!player?.player_user_id && (
                                  <Badge variant="secondary" className="text-xs">
                                    Manual Entry
                                  </Badge>
                                )}
                                {player?.player_user_id === currentUserId && (
                                  <Badge variant="outline" className="text-xs text-green-600">
                                    You
                                  </Badge>
                                )}
                              </div>
                              {player.dupr_rating && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {player.dupr_rating} DUPR
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isCreator && matches.length === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePlayer(player.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No players registered yet. Be the first to join!
                    </div>
                  )
                )}
              </CardContent>
            </Card>
  
            {isCreator && players.length >= 2 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>{matches.length === 0 ? 'Generate Schedule' : 'Roster & schedule'}</CardTitle>
                  <CardDescription>
                    {matches.length === 0
                      ? tournament.team_format === 'doubles'
                        ? 'Players will be automatically paired into teams when the schedule is generated.'
                        : 'Create matchups for all players using round-robin format.'
                      : 'Add players in Settings or here, then rebuild. Completed games are kept; remaining matchups are realigned.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() =>
                      generateSchedule(matches.length > 0 ? { softDeleteUnlockedFirst: true } : undefined)
                    }
                    disabled={generatingSchedule || (matches.length === 0 && currentCount < capacity)}
                    className="w-full"
                  >
                    {generatingSchedule
                      ? matches.length > 0
                        ? 'Rebuilding...'
                        : 'Generating...'
                      : matches.length > 0
                        ? 'Rebuild Schedule'
                        : 'Generate Schedule'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
  
          <TabsContent value="matchups" className="mt-6">
            {matches.length > 0 ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle>Match Schedule</CardTitle>
                    <CardDescription>Click on a match to enter scores</CardDescription>
                  </div>
                  {isCreator && tournament.has_playoffs && !tournament.playoffs_started && (
                    <Button
                      size="sm"
                      onClick={startPlayoffs}
                      disabled={startingPlayoffs || standings.length < 2}
                      className="gap-2 shrink-0"
                    >
                      <Trophy className="h-4 w-4" />
                      {startingPlayoffs ? 'Starting...' : 'Generate Playoffs'}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
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
                            rounds={scheduleTeamIds}
                            labels={scheduleTeamLabels}
                            ariaLabel="teams"
                          />
                        </Tabs>

                        {activeScheduleTeamId ? (
                          <div className="space-y-3">
                            <div>
                              <h3 className="font-semibold">{scheduleTeamLabels[activeScheduleTeamId]}</h3>
                              <p className="text-sm text-muted-foreground">
                                {activeScheduleTeamMatches.length} {activeScheduleTeamMatches.length === 1 ? 'match' : 'matches'}
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {activeScheduleTeamMatches.map((match) => {
                                const names = formatMatchTeams(match);
                                const isTeam1 = match.team1_id === activeScheduleTeamId;
                                const opponent = isTeam1 ? names.team2 : names.team1;
                                const teamGamesWon = isTeam1 ? match.team1_games_won : match.team2_games_won;
                                const opponentGamesWon = isTeam1 ? match.team2_games_won : match.team1_games_won;

                                return (
                                  <div
                                    key={match.id}
                                    className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary/50 hover:shadow-md ${
                                      match.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                                    }`}
                                    onClick={() => openScoreDialog(match)}
                                  >
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                      <Badge variant="outline">Round {match.round_number}</Badge>
                                      {match.status === 'completed' ? (
                                        <Badge className="bg-green-600 text-xs">Completed</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">Pending</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                      <div>
                                        <p className="font-medium">{scheduleTeamLabels[activeScheduleTeamId]}</p>
                                        <p className="text-sm text-muted-foreground">vs {opponent}</p>
                                      </div>
                                      <span className="text-lg font-semibold">
                                        {match.status === 'completed'
                                          ? `${teamGamesWon || 0} - ${opponentGamesWon || 0}`
                                          : '—'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="py-6 text-center text-sm text-muted-foreground">
                            No teams are assigned to this schedule.
                          </p>
                        )}
                      </div>
                    ) : (
                      <Tabs defaultValue={determineDefaultRound(matchesByRound, sortedRounds)} className="w-full">
                        <ScrollableRoundTabs rounds={sortedRounds} emptyCounts={getEmptyGameCounts(matchesByRound)} />
                        {sortedRounds.map((round) => (
                      <TabsContent key={round} value={round} className="mt-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          {matchesByRound[round].map((match) => {
                            const teams = formatMatchTeams(match);
                            let team1GamesWon = 0;
                            let team2GamesWon = 0;
                            let team1TotalPoints = 0;
                            let team2TotalPoints = 0;
  
                            if (match.status === 'completed') {
                              for (let i = 1; i <= tournament.best_of; i++) {
                                const team1Points = (match as any)[`game${i}_team1_points`];
                                const team2Points = (match as any)[`game${i}_team2_points`];
                                if (team1Points != null && team2Points != null) {
                                  team1TotalPoints += team1Points;
                                  team2TotalPoints += team2Points;
                                  if (team1Points > team2Points) team1GamesWon++;
                                  else if (team2Points > team1Points) team2GamesWon++;
                                }
                              }
                            }
  
                            return (
                              <div
                                key={match.id}
                                className={`bg-card border rounded-lg overflow-hidden hover:shadow-md hover:border-primary/50 transition-all ${
                                  match.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                                }`}
                              >
                                <div className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {match.status === 'completed' && (
                                        <Badge className="bg-green-600 text-xs">Completed</Badge>
                                      )}
                                      {match.is_score_confirmed ? (
                                        <Badge className="bg-green-700 text-xs">Confirmed</Badge>
                                      ) : (match.team1_games_won || 0) + (match.team2_games_won || 0) > 0 ? (
                                        <Badge className="bg-amber-500 text-white text-xs">Pending</Badge>
                                      ) : null}
                                    </div>
                                    {isCreator && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMatchToDelete(match);
                                          setShowDeleteDialog(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                  <div className="cursor-pointer" onClick={() => openScoreDialog(match)}>
                                  <div className="space-y-2">
                                    <div className={`flex items-center justify-between p-3 rounded transition-colors ${
                                      match.status === 'completed' && match.winner_team_id === match.team1_id
                                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                                        : 'bg-muted/50'
                                    }`}>
                                      <div className="flex-1 mr-2 min-w-[120px]">
                                        <div className="flex items-center gap-1.5 text-base font-medium">
                                          {match.status === 'completed' && match.winner_team_id === match.team1_id && (
                                            <Crown className="h-4 w-4 text-yellow-500 shrink-0" />
                                          )}
                                          {teams.team1}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const allGameScores = [
                                            { team1: (match as any).game1_team1_points, team2: (match as any).game1_team2_points },
                                            { team1: (match as any).game2_team1_points, team2: (match as any).game2_team2_points },
                                            { team1: (match as any).game3_team1_points, team2: (match as any).game3_team2_points },
                                            { team1: (match as any).game4_team1_points, team2: (match as any).game4_team2_points },
                                            { team1: (match as any).game5_team1_points, team2: (match as any).game5_team2_points },
                                          ];
  
                                          // Only show games up to best_of
                                          const gameScores = allGameScores.slice(0, tournament.best_of);
  
                                          return gameScores.map((game, idx) => {
                                            if (game.team1 == null || game.team2 == null) {
                                              return match.status === 'completed' ? null : (
                                                <div key={idx} className="w-12 h-10 flex items-center justify-center rounded bg-muted/50 text-muted-foreground font-semibold">
                                                  -
                                                </div>
                                              );
                                            }
                                            const isWinner = game.team1 > game.team2;
                                            return (
                                              <div
                                                key={idx}
                                                className={`w-12 h-10 flex items-center justify-center rounded font-semibold ${
                                                  isWinner ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                                }`}
                                              >
                                                {game.team1}
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-center py-1">
                                      <span className="text-xs font-semibold text-muted-foreground">VS</span>
                                    </div>
                                    <div className={`flex items-center justify-between p-3 rounded transition-colors ${
                                      match.status === 'completed' && match.winner_team_id === match.team2_id
                                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                                        : 'bg-muted/50'
                                    }`}>
                                      <div className="flex-1 mr-2 min-w-[120px]">
                                        <div className="flex items-center gap-1.5 text-base font-medium">
                                          {match.status === 'completed' && match.winner_team_id === match.team2_id && (
                                            <Crown className="h-4 w-4 text-yellow-500 shrink-0" />
                                          )}
                                          {teams.team2}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const allGameScores = [
                                            { team1: (match as any).game1_team1_points, team2: (match as any).game1_team2_points },
                                            { team1: (match as any).game2_team1_points, team2: (match as any).game2_team2_points },
                                            { team1: (match as any).game3_team1_points, team2: (match as any).game3_team2_points },
                                            { team1: (match as any).game4_team1_points, team2: (match as any).game4_team2_points },
                                            { team1: (match as any).game5_team1_points, team2: (match as any).game5_team2_points },
                                          ];
  
                                          // Only show games up to best_of
                                          const gameScores = allGameScores.slice(0, tournament.best_of);
  
                                          return gameScores.map((game, idx) => {
                                            if (game.team1 == null || game.team2 == null) {
                                              return match.status === 'completed' ? null : (
                                                <div key={idx} className="w-12 h-10 flex items-center justify-center rounded bg-muted/50 text-muted-foreground font-semibold">
                                                  -
                                                </div>
                                              );
                                            }
                                            const isWinner = game.team2 > game.team1;
                                            return (
                                              <div
                                                key={idx}
                                                className={`w-12 h-10 flex items-center justify-center rounded font-semibold ${
                                                  isWinner ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                                                }`}
                                              >
                                                {game.team2}
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    ))}
                      </Tabs>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No schedule generated yet. Generate a schedule from the Players tab.
                </CardContent>
              </Card>
            )}
          </TabsContent>
  
          {tournament.has_playoffs && (
            <TabsContent value="playoffs" className="mt-6 space-y-4">
              {tournament.champion_team_id && (() => {
                const championPlayers = players.filter(p => p.id.startsWith(tournament.champion_team_id!));
                const championName = championPlayers.map(p => p.player_name).join(' & ') || 'Champion';
                return (
                  <div className="flex items-center justify-center gap-3 p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <Crown className="h-6 w-6 text-yellow-500 shrink-0" />
                    <div className="text-center">
                      <div className="text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">Tournament Champion</div>
                      <div className="text-lg font-bold text-yellow-800 dark:text-yellow-300">{championName}</div>
                    </div>
                    <Crown className="h-6 w-6 text-yellow-500 shrink-0" />
                  </div>
                );
              })()}
              {playoffMatches.length > 0 ? (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Playoff Bracket
                      </CardTitle>
                      <CardDescription>Single-elimination bracket — click a match to enter scores</CardDescription>
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
                    {tournament.playoff_reseeding && isCreator && findPendingReseedRound(playoffMatches, true) && (
                      <Alert className="mb-4 border-amber-300 bg-amber-50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span>
                            {findPendingReseedRound(playoffMatches, true)} is complete. Rank remaining players to generate{' '}
                            {getNextPlayoffRound(findPendingReseedRound(playoffMatches, true)!)}.
                          </span>
                          <Button
                            size="sm"
                            onClick={() => {
                              const pendingRound = findPendingReseedRound(playoffMatches, true);
                              if (!pendingRound) return;
                              setReseedDialogDismissedForRound(null);
                              openReseedDialogForRound(pendingRound);
                            }}
                          >
                            Reseed Next Round
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                    <PlayoffBracket
                      matches={playoffMatches}
                      bestOf={tournament.best_of}
                      onMatchClick={(match) => {
                        setSelectedMatch(match as unknown as KingOfTheHillMatch);
                        const initialScores: Record<number, { team1: string; team2: string }> = {};
                        for (let i = 1; i <= tournament.best_of; i++) {
                          const t1 = (match as any)[`game${i}_team1_points`];
                          const t2 = (match as any)[`game${i}_team2_points`];
                          initialScores[i] = { team1: t1 !== null ? t1.toString() : '', team2: t2 !== null ? t2.toString() : '' };
                        }
                        setLocalGameScores(initialScores);
                        setShowScoreDialog(true);
                      }}
                      isSingles={tournament.team_format === 'singles'}
                      isCreator={isCreator}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>Playoffs have not started yet</p>
                    {isCreator && !tournament.playoffs_started && (
                      <Button
                        onClick={startPlayoffs}
                        disabled={startingPlayoffs}
                        className="mt-4 gap-2"
                      >
                        <Trophy className="h-4 w-4" />
                        {startingPlayoffs ? 'Starting...' : 'Generate Playoffs'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          <TabsContent value="standings" className="mt-6">
            {matches.length > 0 ? (
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
                        Share
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {standings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-semibold text-sm">Rank</th>
                            <th className="text-left py-3 px-2 font-semibold text-sm">Player</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm" title="Games Won">GW</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm" title="Games Lost">GL</th>
                            <th className="text-center py-3 px-2 font-semibold text-sm">PtDiff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((standing, index) => (
                            <tr key={standing?.player_id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2 font-bold">#{index + 1}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{standing?.player_name}</span>
                                  {tournament.champion_team_id && standing.player_id.startsWith(tournament.champion_team_id) && (
                                    <Crown className="h-4 w-4 text-yellow-500" />
                                  )}
                                  {index === 0 && !tournament.champion_team_id && <Trophy className="h-4 w-4 text-yellow-500" />}
                                </div>
                                {standing.dupr_rating && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {standing.dupr_rating} DUPR
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3 px-2 text-center font-semibold text-green-600">{standing.games_won}</td>
                              <td className="py-3 px-2 text-center font-semibold text-red-600">{standing.games_lost}</td>
                              <td className="py-3 px-2 text-center">
                                <span className={`font-semibold ${standing.point_differential >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {standing.point_differential > 0 ? '+' : ''}{standing.point_differential}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No standings available yet
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

          {showSettingsTab && (
            <TabsContent value="settings" className="mt-6">
              <TournamentIndividualSettingsForm
                tournament={tournament}
                currentPlayerCount={currentCount}
                onSaved={onTournamentUpdate}
              />
            </TabsContent>
          )}
        </Tabs>
  
        <Dialog open={showUnifiedPlayerDialog} onOpenChange={setShowUnifiedPlayerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Player Management</DialogTitle>
              <DialogDescription>
                {tournament.is_dupr_required
                  ? 'Join the tournament with your DUPR account'
                  : 'Join the tournament or add players'
                }
              </DialogDescription>
            </DialogHeader>
            <Tabs value={playerDialogTab} onValueChange={(v) => setPlayerDialogTab(v as 'join' | 'add')}>
              <TabsList className={isCreator && !tournament.is_dupr_required ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
                <TabsTrigger value="join" disabled={!canJoin}>Join Myself</TabsTrigger>
                {isCreator && !tournament.is_dupr_required && (
                  <TabsTrigger value="add" disabled={matches.length > 0 || currentCount >= capacity}>
                    Add Someone
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="join" className="space-y-4 py-4">
                {tournament.is_dupr_required && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      This tournament requires DUPR authentication. You must have a linked DUPR account to join. Manual player additions are not allowed.
                    </AlertDescription>
                  </Alert>
                )}
                {tournament.dupr_plus_required_subs && tournament.dupr_plus_required_subs.filter(t => t !== 'BASIC_L1').length > 0 && (
                  <Alert className="border border-red-600" >
                    <ShieldAlert className="h-4 w-4 " color="red" />
                    <AlertDescription className="text-xs  text-red-600 ">
                      {(() => {
                        const tierLabels: Record<string, string> = { PREMIUM_L1: 'Premium', VERIFIED_L1: 'Verified' };
                        const friendly = tournament.dupr_plus_required_subs.filter(t => t !== 'BASIC_L1').map(t => tierLabels[t] ?? t);
                        return <>To join this tournament you need an active DUPR+ subscription: <span className="font-semibold">{friendly.join(' or ')}</span></>;
                      })()}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="join-name">Your Name</Label>
                  <Input
                    id="join-name"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Enter your name"
                    autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && joinName.trim()) {
                        if (tournament.is_dupr_required && !currentUserDuprId) {
                          toast({ title: 'DUPR required', description: 'You must have a linked DUPR account to join this tournament. Please sign in with DUPR first.', variant: 'destructive' });
                          return;
                        }
                        if (tournament.dupr_plus_required_subs && tournament.dupr_plus_required_subs.length > 0) {
                          if (!currentUserDuprId) {
                            toast({ title: 'DUPR required', description: 'You must have a linked DUPR account to join this tournament.', variant: 'destructive' });
                            return;
                          }
                          const { data: subCache } = await supabase.from('dupr_subscriptions_cache').select('tournaments, expires_at').eq('dupr_id', currentUserDuprId).maybeSingle();
                          if (!subCache || new Date(subCache.expires_at) < new Date()) {
                            toast({ title: 'Subscription status unavailable', description: 'Your DUPR subscription status could not be verified. Please refresh your DUPR profile and try again.', variant: 'destructive' });
                            return;
                          }
                          const hasRequiredSub = tournament.dupr_plus_required_subs.some((r) => subCache.tournaments.includes(r));
                          if (!hasRequiredSub) {
                            const tierLabels: Record<string, string> = { PREMIUM_L1: 'Premium', VERIFIED_L1: 'Verified' };
                            const friendlyTiers = tournament.dupr_plus_required_subs.filter(t => t !== 'BASIC_L1').map(t => tierLabels[t] ?? t);
                            toast({ title: 'DUPR+ subscription required', description: `This tournament requires a DUPR ${friendlyTiers.join(' or ')} subscription to join.`, variant: 'destructive' });
                            return;
                          }
                        }
                        addPlayer(joinName, currentUserId, currentUserDuprId, currentUserDuprRating);
                        setShowUnifiedPlayerDialog(false);
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowUnifiedPlayerDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (tournament.is_dupr_required && !currentUserDuprId) {
                        toast({ title: 'DUPR required', description: 'You must have a linked DUPR account to join this tournament. Please sign in with DUPR first.', variant: 'destructive' });
                        return;
                      }
                      if (tournament.dupr_plus_required_subs && tournament.dupr_plus_required_subs.length > 0) {
                        if (!currentUserDuprId) {
                          toast({ title: 'DUPR required', description: 'You must have a linked DUPR account to join this tournament.', variant: 'destructive' });
                          return;
                        }
                        const { data: subCache } = await supabase.from('dupr_subscriptions_cache').select('tournaments, expires_at').eq('dupr_id', currentUserDuprId).maybeSingle();
                        if (!subCache || new Date(subCache.expires_at) < new Date()) {
                          toast({ title: 'Subscription status unavailable', description: 'Your DUPR subscription status could not be verified. Please refresh your DUPR profile and try again.', variant: 'destructive' });
                          return;
                        }
                        const hasRequiredSub = tournament.dupr_plus_required_subs.some((r) => subCache.tournaments.includes(r));
                        if (!hasRequiredSub) {
                          toast({ title: 'DUPR+ subscription required', description: `This tournament requires one of the following subscription tiers: ${tournament.dupr_plus_required_subs.join(', ')}`, variant: 'destructive' });
                          return;
                        }
                      }
                      addPlayer(joinName, currentUserId, currentUserDuprId, currentUserDuprRating);
                      setShowUnifiedPlayerDialog(false);
                    }}
                    disabled={!joinName.trim() || (!isCreator && currentUserHasRequiredSub === false)}
                  >
                    Join Tournament
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="add" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-player-name">Player Name</Label>
                  <Input
                    id="manual-player-name"
                    value={manualPlayerName}
                    onChange={(e) => setManualPlayerName(e.target.value)}
                    placeholder="Enter player name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualPlayerName.trim()) {
                        handleAddManualPlayer();
                        if (!addingManualPlayer) {
                          setShowUnifiedPlayerDialog(false);
                        }
                      }
                    }}
                  />
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This player will be added without a user account. They won&apos;t be able to enter scores themselves.
                  </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUnifiedPlayerDialog(false);
                      setManualPlayerName('');
                    }}
                    disabled={addingManualPlayer}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      await handleAddManualPlayer();
                      if (!addingManualPlayer) {
                        setShowUnifiedPlayerDialog(false);
                      }
                    }}
                    disabled={!manualPlayerName.trim() || addingManualPlayer}
                  >
                    {addingManualPlayer ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Player'
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
  
        <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedMatch?.match_status === 'completed' ? 'Match Complete' : 'Enter Match Score'}
              </DialogTitle>
              <DialogDescription>
                Best of {tournament.best_of} - First to {Math.ceil(tournament.best_of / 2)} games wins
              </DialogDescription>
              {selectedMatch && (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 && (() => {
                const teams = formatMatchTeams(selectedMatch);
                return (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={selectedMatch.match_status === 'completed' ? 'default' : 'secondary'} className="text-sm">
                      {selectedMatch.match_status === 'completed'
                        ? `Match Complete: ${teams.team1} ${selectedMatch.team1_games_won} - ${selectedMatch.team2_games_won} ${teams.team2}`
                        : `Series: ${selectedMatch.team1_games_won || 0} - ${selectedMatch.team2_games_won || 0}`}
                    </Badge>
                    {selectedMatch.is_score_confirmed ? (
                      <Badge className="bg-green-600 text-white text-xs">Confirmed</Badge>
                    ) : (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 ? (
                      <Badge className="bg-amber-500 text-white text-xs">Pending Confirmation</Badge>
                    ) : null}
                  </div>
                );
              })()}
              {selectedMatch && !tournament?.dupr_club_id && !selectedMatch.is_score_confirmed && (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 && canUserConfirmScore() && (
                <p className="text-xs text-muted-foreground pt-1">Scores have been submitted and are awaiting your confirmation.</p>
              )}
              {selectedMatch && tournament?.dupr_club_id && !selectedMatch.is_score_confirmed && (selectedMatch.team1_games_won || 0) + (selectedMatch.team2_games_won || 0) > 0 && (
                <p className="text-xs text-muted-foreground pt-1">Scores will be confirmed when synced to DUPR.</p>
              )}
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              {selectedMatch && Array.from({ length: tournament.best_of }, (_, i) => i + 1).map((gameNum) => {
                const teams = formatMatchTeams(selectedMatch);
                const team1Score = selectedMatch[`game${gameNum}_team1_points` as keyof KingOfTheHillMatch] as number | null;
                const team2Score = selectedMatch[`game${gameNum}_team2_points` as keyof KingOfTheHillMatch] as number | null;
                const isCompleted = team1Score !== null && team2Score !== null;
  
                const gamesToWin = Math.ceil(tournament.best_of / 2);
                const team1GamesWon = selectedMatch.team1_games_won || 0;
                const team2GamesWon = selectedMatch.team2_games_won || 0;
                const matchDecided = team1GamesWon >= gamesToWin || team2GamesWon >= gamesToWin;
  
                const hasAccess = canUserEnterScore(selectedMatch);
                return (
                  <GameScoreInput
                    key={gameNum}
                    gameNumber={gameNum}
                    team1Name={teams.team1}
                    team2Name={teams.team2}
                    team1Score={team1Score}
                    team2Score={team2Score}
                    isCompleted={isCompleted}
                    isDisabled={!hasAccess}
                    onScoreChange={handleScoreChange}
                    canEdit={hasAccess}
                    matchDecided={matchDecided && !isCompleted}
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
              </div>
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
              <DialogTitle>Delete Tournament</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this tournament?
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
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/tournaments/${tournament.id}`}
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
  
        <Dialog open={showDeleteDialog} onOpenChange={(open) => {
          if (!open && !deletingMatch) {
            setShowDeleteDialog(false);
            setMatchToDelete(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Match</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this match? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setMatchToDelete(null);
                }}
                disabled={deletingMatch}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteMatch}
                disabled={deletingMatch}
              >
                {deletingMatch ? (
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

        <PlayoffReseedDialog
          open={reseedDialogOpen}
          onOpenChange={handleReseedDialogOpenChange}
          fromRound={reseedFromRound}
          survivors={reseedSurvivors}
          generating={generatingReseedRound}
          onConfirm={generateReseededRound}
        />
      </div>
    );
  }
