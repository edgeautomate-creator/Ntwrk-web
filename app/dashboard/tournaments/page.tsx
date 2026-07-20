'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, MapPin, Users, Trophy, Lock, Search, X, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CircleAlert as AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';

interface Tournament {
  id: string;
  name: string;
  date: string | null;
  start_time: string | null;
  location: string | null;
  expected_teams: number;
  playoff_teams: number | null;
  playoff_qualifiers: number | null;
  has_playoffs: boolean | null;
  format: string;
  best_of: number;
  is_private: boolean;
  access_code: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  team_format?: 'singles' | 'doubles';
  participant_count?: number;
  registered_players_count?: number;
  dupr_club_id?: string | null;
  dupr_club_name?: string | null;
}

export default function TournamentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [myTournamentIds, setMyTournamentIds] = useState<Set<string>>(new Set());
  const [selectedFilters, setSelectedFilters] = useState<{
    teamFormat: ('singles' | 'doubles')[];
    gameFormat: ('round_robin_individual' | 'group_stage_playoffs')[];
    showMyGames: boolean;
    clubId: string;
  }>({
    teamFormat: [],
    gameFormat: [],
    showMyGames: false,
    clubId: ''
  });

  useEffect(() => {
    if (!authLoading && user) {
      loadTournaments();
      loadMyTournamentIds();
    }
  }, [authLoading, user]);

  const loadMyTournamentIds = async () => {
    if (!user) return;

    try {
      const { data: myParticipations } = await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .eq('user_id', user.id)
        .eq('status', 'approved');

      const participantTournamentIds = myParticipations?.map(p => p.tournament_id) || [];
      const allMyTournamentIds = new Set([...participantTournamentIds]);

      setMyTournamentIds(allMyTournamentIds);
    } catch (error) {
      console.error('Error loading my tournament IDs:', error);
    }
  };

  const loadTournaments = async () => {
    try {
      setLoading(true);
      if (!user) return;

      const query = supabase
        .from('tournaments')
        .select('*')
        .order('updated_at', { ascending: false });

      const { data: tournamentsData, error } = await query;

      if (error) throw error;

      // Use registered_players_count from database instead of manual counting
      const tournamentsWithCounts = (tournamentsData || []).map(tournament => ({
        ...tournament,
        participant_count: tournament.registered_players_count || 0
      }));

      setTournaments(tournamentsWithCounts);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (category: 'teamFormat' | 'gameFormat', value: string) => {
    setSelectedFilters(prev => {
      const currentValues = prev[category] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [category]: newValues };
    });
  };

  const toggleMyGamesFilter = () => {
    setSelectedFilters(prev => ({
      ...prev,
      showMyGames: !prev.showMyGames
    }));
  };

  const clearAllFilters = () => {
    setSelectedFilters({
      teamFormat: [],
      gameFormat: [],
      showMyGames: false,
      clubId: ''
    });
  };

  const availableClubs = Array.from(
    new Map(
      tournaments
        .filter(t => t.dupr_club_id && t.dupr_club_name)
        .map(t => [t.dupr_club_id!, { id: t.dupr_club_id!, name: t.dupr_club_name! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const hasActiveFilters = selectedFilters.teamFormat.length > 0 || selectedFilters.gameFormat.length > 0 || selectedFilters.showMyGames || !!selectedFilters.clubId;
  const activeFilterCount = selectedFilters.teamFormat.length + selectedFilters.gameFormat.length + (selectedFilters.showMyGames ? 1 : 0) + (selectedFilters.clubId ? 1 : 0);

  const filteredTournaments = tournaments.filter(tournament => {
    // Text search filter
    const matchesSearch =
      tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tournament.location?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Apply "My Games" filter
    if (selectedFilters.showMyGames) {
      const isMyGame = tournament.created_by === user?.id || myTournamentIds.has(tournament.id);
      if (!isMyGame) return false;
    }

    // Apply team format filter
    const teamFormatMatch = selectedFilters.teamFormat.length === 0 ||
      selectedFilters.teamFormat.includes(tournament.team_format || 'doubles');

    // Apply game format filter
    const gameFormatMatch = selectedFilters.gameFormat.length === 0 ||
      selectedFilters.gameFormat.includes(tournament.format as any);

    // Apply club filter
    const clubMatch = !selectedFilters.clubId || (!!tournament.dupr_club_id && tournament.dupr_club_id === selectedFilters.clubId);

    return teamFormatMatch && gameFormatMatch && clubMatch;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleTournamentClick = async (tournament: Tournament) => {
    if (tournament.is_private) {
      if (!user) return;

      if (tournament.created_by === user.id) {
        router.push(`/dashboard/tournaments/${tournament.id}`);
        return;
      }

      const { data: participation } = await supabase
        .from('tournament_participants')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .maybeSingle();

      if (participation) {
        router.push(`/dashboard/tournaments/${tournament.id}`);
        return;
      }

      setSelectedTournament(tournament);
      setShowPasswordDialog(true);
      setPasswordInput('');
      setPasswordError('');
    } else {
      router.push(`/dashboard/tournaments/${tournament.id}`);
    }
  };

  const verifyPasswordAndEnter = async () => {
    if (!selectedTournament) return;

    if (passwordInput !== selectedTournament.access_code) {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }

    setShowPasswordDialog(false);
    setPasswordInput('');
    setPasswordError('');
    router.push(`/dashboard/tournaments/${selectedTournament.id}`);
  };

  return (
    <div className="container py-6 px-2 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Find Games</h1>
          <p className="text-gray-600">Browse and join pickleball games</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-4 h-5 w-5 text-gray-500" />
          <Input
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 text-base"
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 text-sm font-medium">Filter by:</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="bg-[#84c225] text-white">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-8"
            >
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedFilters.showMyGames ? 'default' : 'outline'}
            size="sm"
            onClick={toggleMyGamesFilter}
            className={`h-9 transition-all ${
              selectedFilters.showMyGames
                ? 'bg-[#84c225] text-white hover:bg-[#84c225]/90 border-[#84c225]'
                : 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200'
            }`}
          >
            <Users className="h-4 w-4 mr-1" />
            My Games
          </Button>
          <Button
            variant={selectedFilters.teamFormat.includes('singles') ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleFilter('teamFormat', 'singles')}
            className={`h-9 transition-all ${
              selectedFilters.teamFormat.includes('singles')
                ? 'bg-[#84c225] text-white hover:bg-[#84c225]/90 border-[#84c225]'
                : 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200'
            }`}
          >
            Singles
          </Button>
          <Button
            variant={selectedFilters.teamFormat.includes('doubles') ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleFilter('teamFormat', 'doubles')}
            className={`h-9 transition-all ${
              selectedFilters.teamFormat.includes('doubles')
                ? 'bg-[#84c225] text-white hover:bg-[#84c225]/90 border-[#84c225]'
                : 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200'
            }`}
          >
            Doubles
          </Button>
          <Button
            variant={selectedFilters.gameFormat.includes('round_robin_individual') ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleFilter('gameFormat', 'round_robin_individual')}
            className={`h-9 transition-all ${
              selectedFilters.gameFormat.includes('round_robin_individual')
                ? 'bg-[#84c225] text-white hover:bg-[#84c225]/90 border-[#84c225]'
                : 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200'
            }`}
          >
            Round Robin
          </Button>
          <Button
            variant={selectedFilters.gameFormat.includes('group_stage_playoffs') ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleFilter('gameFormat', 'group_stage_playoffs')}
            className={`h-9 transition-all ${
              selectedFilters.gameFormat.includes('group_stage_playoffs')
                ? 'bg-[#84c225] text-white hover:bg-[#84c225]/90 border-[#84c225]'
                : 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200'
            }`}
          >
            Tournament
          </Button>
          {availableClubs.length > 0 && (
            <Select
              value={selectedFilters.clubId || '__all__'}
              onValueChange={(val) =>
                setSelectedFilters(prev => ({ ...prev, clubId: val === '__all__' ? '' : val }))
              }
            >
              <SelectTrigger
                className={`h-9 text-sm w-auto min-w-[140px] transition-all ${
                  selectedFilters.clubId
                    ? 'bg-[#84c225] text-white border-[#84c225] hover:bg-[#84c225]/90 [&>svg]:text-white'
                    : 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200'
                }`}
              >
                <SelectValue placeholder="All Clubs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Clubs</SelectItem>
                {availableClubs.map(club => (
                  <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg animate-pulse p-6">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Trophy className="h-16 w-16 text-gray-400 mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No games found</h3>
            <p className="text-gray-600 mb-6 max-w-md">
              {searchQuery || hasActiveFilters
                ? 'Try adjusting your search or filters'
                : 'Be the first to create a game!'}
            </p>
            {hasActiveFilters && (
              <Button
                onClick={clearAllFilters}
                variant="outline"
                className="h-12 px-8 text-base"
              >
                <X className="h-5 w-5 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-white border border-gray-200 rounded-sm overflow-hidden hover:shadow-lg transition-all"
            >
              {/* Mobile card layout */}
              <div className="block sm:hidden">
                {/* Black header with tournament name */}
                <div className="bg-black px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-base uppercase tracking-wide">
                      {tournament.name}
                    </h3>
                    {tournament.is_private && (
                      <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* Details body */}
                <div className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 mb-1">
                    {tournament.date && (
                      <span className="font-medium uppercase text-xs tracking-wide">
                        {new Date(tournament.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
                      </span>
                    )}
                    {tournament.start_time && (
                      <span className="text-xs font-medium text-gray-600">{formatTime(tournament.start_time)}</span>
                    )}
                    {tournament.location && (
                      <span className="text-xs font-medium text-gray-600 uppercase">{tournament.location}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                      {tournament.format === 'round_robin' && (tournament.has_playoffs ? 'Round Robin + Playoffs' : 'Round Robin')}
                      {tournament.format === 'group_stage_playoffs' && 'Tournament'}
                      {tournament.format === 'round_robin_individual' && (tournament.has_playoffs ? 'Round Robin + Playoffs' : 'Round Robin')}
                    </Badge>
                    <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                      {tournament.team_format === 'singles' ? 'Singles' : 'Doubles'}
                    </Badge>
                    {tournament.format !== 'round_robin_individual' && tournament.has_playoffs && tournament.playoff_teams && (
                      <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                        {tournament.playoff_teams} playoff spots
                      </Badge>
                    )}
                    {tournament.format === 'round_robin_individual' && tournament.has_playoffs && tournament.playoff_qualifiers && (
                      <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                        {tournament.playoff_qualifiers} playoff spots
                      </Badge>
                    )}
                    {tournament.format !== 'round_robin_individual' && tournament.best_of === 1 && (
                      <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                        Single Game
                      </Badge>
                    )}
                    {tournament.best_of > 1 && (
                      <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                        Best of {tournament.best_of}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    {tournament.format === 'round_robin_individual'
                      ? `${tournament.participant_count || 0}/${(tournament as any).player_capacity || 0} `
                      : `${tournament.team_format === 'singles' ? (tournament.participant_count || 0) : Math.floor((tournament.participant_count || 0) / 2)}/${tournament.expected_teams} `}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 text-white bg-[#000000] hover:bg-[#808080]  font-bold uppercase text-sm h-10 rounded-sm"
                      onClick={() => handleTournamentClick(tournament)}
                    >
                      JOIN GAME
                    </Button>
                  </div>
                </div>
              </div>

              {/* Desktop card layout (unchanged) */}
              <div
                className="hidden sm:block p-6 cursor-pointer"
                onClick={() => handleTournamentClick(tournament)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{tournament.name}</h3>
                          {tournament.is_private && (
                            <Lock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                            {tournament.format === 'round_robin' && (tournament.has_playoffs ? 'Round Robin + Playoffs' : 'Round Robin')}
                            {tournament.format === 'group_stage_playoffs' && 'Tournament'}
                            {tournament.format === 'round_robin_individual' && (tournament.has_playoffs ? 'Round Robin + Playoffs' : 'Round Robin')}
                          </Badge>
                          <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                            {tournament.team_format === 'singles' ? 'Singles' : 'Doubles'}
                          </Badge>
                          {tournament.format !== 'round_robin_individual' && tournament.has_playoffs && tournament.playoff_teams && (
                            <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                              {tournament.playoff_teams} playoff spots
                            </Badge>
                          )}
                          {tournament.format === 'round_robin_individual' && tournament.has_playoffs && tournament.playoff_qualifiers && (
                            <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                              {tournament.playoff_qualifiers} playoff spots
                            </Badge>
                          )}
                          {tournament.format !== 'round_robin_individual' && tournament.best_of === 1 && (
                            <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                              Single Game
                            </Badge>
                          )}
                          {tournament.best_of > 1 && (
                            <Badge className="bg-[#84c225] hover:bg-[#84c225] text-white border-0 rounded-full">
                              Best of {tournament.best_of}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                      {tournament.date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>
                            {formatDate(tournament.date)}
                            {tournament.start_time && ` at ${formatTime(tournament.start_time)}`}
                          </span>
                        </div>
                      )}
                      {tournament.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span>{tournament.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>
                          {tournament.format === 'round_robin_individual'
                            ? `${tournament.participant_count || 0} / ${(tournament as any).player_capacity || 0} players`
                            : `${tournament.team_format === 'singles' ? (tournament.participant_count || 0) : Math.floor((tournament.participant_count || 0) / 2)} / ${tournament.expected_teams} teams`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 sm:text-right">
                    Updated {formatDistanceToNow(new Date(tournament.updated_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Password Required</DialogTitle>
            <DialogDescription>
              This is a private game. Enter the password to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter game password"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && passwordInput.trim()) {
                    verifyPasswordAndEnter();
                  }
                }}
              />
            </div>
            {passwordError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setPasswordInput('');
                setPasswordError('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={verifyPasswordAndEnter}
              disabled={!passwordInput.trim()}
              className="bg-[#84c225] hover:bg-[#84c225]/90"
            >
              Enter Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
