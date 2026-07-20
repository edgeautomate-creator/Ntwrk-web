'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { ensureAuthReady } from '@/lib/auth-helpers';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, isValid } from 'date-fns';
import { CircleAlert as AlertCircle, Info, RefreshCw, Loader as Loader2, Dumbbell, Trophy, ArrowLeft, Calendar as CalendarIcon, Clock } from 'lucide-react';

const getDefaultDateTime = () => {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const time = `${hours}:${minutes}`;
  return { date, time };
};

export default function CreateTournamentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [duprClubs, setDuprClubs] = useState<{ id: string; name: string }[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState('');
  const [clubsCached, setClubsCached] = useState(false);
  const [clubsLastSynced, setClubsLastSynced] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileStep, setMobileStep] = useState(1); // 1 = format selection, 2 = form

  const defaultDateTime = getDefaultDateTime();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    date: defaultDateTime.date,
    startTime: defaultDateTime.time,
    location: '',
    format: 'round_robin_individual' as 'round_robin' | 'group_stage_playoffs' | 'round_robin_individual',
    teamFormat: 'doubles' as 'singles' | 'doubles',
    expectedTeams: 4,
    playerCapacity: 8,
    playoffTeams: 2,
    playoffByes: 0,
    hasPlayoffs: false,
    playoffReseeding: false,
    playoffQualifiers: 4,
    bestOf: 1 as 1 | 3 | 5,
    isPrivate: false,
    accessCode: '',
    isDuprRequired: false,
    duprClubId: '',
    duprClubName: '',
    isDuprPlusRequired: false,
    duprPlusRequiredSubs: [] as string[],
    groupsEnabled: false,
    numberOfGroups: 2,
    teamsPerGroupAdvancing: 2,
    poolPlayEnabled: false,
    teamsPerPool: 4,
    gamesPerPool: 2,
    poolAdvanceCount: 2,
    poolByeCount: 0,
    tiebreakerPointDifferentialFirst: false,
  });

  const fetchDuprClubs = useCallback(async () => {
    setClubsError('');
    setClubsLoading(true);
    setClubsCached(false);
    setClubsLastSynced(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setClubsError('Please log in to load DUPR clubs.');
        setDuprClubs([]);
        setClubsLoading(false);
        return;
      }
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-user-clubs`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('DUPR clubs fetch error:', { status: response.status, data });

        if (response.status === 400 && data.error?.includes('No DUPR account linked')) {
          setClubsError('No DUPR account connected.');
        } else if (response.status === 401) {
          setClubsError(data.error || 'DUPR authentication failed. Please reconnect your DUPR account.');
        } else if (data.details) {
          setClubsError(`${data.error || 'Failed to load DUPR clubs'} - ${data.details}`);
        } else {
          setClubsError(data.error || 'Failed to load DUPR clubs.');
        }
        setDuprClubs([]);
        setClubsLoading(false);
        return;
      }

      const clubs = data.clubs ?? [];
      setDuprClubs(clubs);
      setClubsCached(data.cached || false);
      setClubsLastSynced(data.lastSyncedAt || null);

      if (data.cached && data.warning) {
        setClubsError(data.warning);
      } else if (clubs.length === 0 && data.message) {
        setClubsError(data.message);
      } else if (clubs.length === 0) {
        setClubsError('No DUPR clubs found for your account.');
      }

      setClubsLoading(false);
    } catch (err) {
      console.error('Error fetching DUPR clubs:', err);
      setClubsError('Network error: Unable to load DUPR clubs.');
      setDuprClubs([]);
      setClubsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (formData.isDuprRequired) {
      fetchDuprClubs();
    } else {
      setDuprClubs([]);
      setClubsError('');
      setFormData((prev) => ({ ...prev, duprClubId: '', duprClubName: '' }));
    }
  }, [formData.isDuprRequired, fetchDuprClubs]);

  const validatePlayoffStructure = (playoffTeams: number, byeTeams: number): boolean => {
    if (byeTeams >= playoffTeams) return false;
    let currentTeams = playoffTeams;
    let currentByes = byeTeams;
    while (currentTeams > 1) {
      const playingTeams = currentTeams - currentByes;
      if (playingTeams < 0 || playingTeams % 2 !== 0) return false;
      const winners = playingTeams / 2;
      const nextRoundTeams = winners + currentByes;
      if (nextRoundTeams === 1) return true;
      if (nextRoundTeams % 2 !== 0 && nextRoundTeams !== 1) return false;
      currentTeams = nextRoundTeams;
      currentByes = 0;
    }
    return true;
  };

  const calculateGames = (teams: number, format: string) => {
    if (format === 'round_robin') {
      return (teams * (teams - 1)) / 2;
    }
    const teamsPerGroup = Math.ceil(teams / 2);
    const groupGames = 2 * ((teamsPerGroup * (teamsPerGroup - 1)) / 2);
    const playoffGames = formData.playoffTeams - 1;
    return groupGames + playoffGames;
  };

  const shouldRecommendGroups = () => {
    const teams = formData.expectedTeams;
    const roundRobinGames = (teams * (teams - 1)) / 2;
    return teams >= 7 && roundRobinGames > 15;
  };

  const handleReauthenticate = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthError(false);
    setLoading(true);

    if (formData.isDuprRequired && !formData.duprClubId) {
      setError('A DUPR club must be selected to create a DUPR-required tournament.');
      setLoading(false);
      return;
    }

    if (formData.format === 'group_stage_playoffs' && formData.hasPlayoffs && !formData.poolPlayEnabled) {
      if (!validatePlayoffStructure(formData.playoffTeams, formData.playoffByes)) {
        setError(`${formData.playoffTeams} playoff teams with ${formData.playoffByes} bye${formData.playoffByes !== 1 ? 's' : ''} cannot produce a valid bracket. Please adjust the playoff settings.`);
        setLoading(false);
        return;
      }
    }

    if (formData.poolPlayEnabled) {
      const numPools = formData.teamsPerPool >= 2 ? Math.ceil(formData.expectedTeams / formData.teamsPerPool) : 1;
      const totalAdvancing = formData.poolAdvanceCount * numPools;
      const byeTeams = formData.poolByeCount * numPools;
      if (!validatePlayoffStructure(totalAdvancing, byeTeams)) {
        setError(`${totalAdvancing} advancing teams with ${byeTeams} bye${byeTeams !== 1 ? 's' : ''} cannot produce a valid playoff bracket. Please adjust the pool play settings.`);
        setLoading(false);
        return;
      }
    }

    try {
      const authCheck = await ensureAuthReady();

      if (!authCheck.success || !authCheck.client) {
        setAuthError(true);
        setError(authCheck.error || 'Authentication check failed.');
        setLoading(false);
        return;
      }

      const userId = authCheck.userId!;
      const authenticatedClient = authCheck.client;

      console.log('Creating tournament with authenticated client for user:', userId);

      const isRoundRobinIndividual = formData.format === 'round_robin_individual';
      const isGroupStagePlayoffs = formData.format === 'group_stage_playoffs';
      const registrationType = isRoundRobinIndividual ? 'individual' : 'team';

      const { data: tournament, error: insertError } = await authenticatedClient
        .from('tournaments')
        .insert({
          name: formData.name,
          created_by: userId,
          date: formData.date || null,
          start_time: formData.startTime || null,
          location: formData.location || null,
          format: formData.format,
          registration_type: registrationType,
          team_format: formData.teamFormat,
          expected_teams: isRoundRobinIndividual ? null : formData.expectedTeams,
          player_capacity: isRoundRobinIndividual ? formData.playerCapacity : null,
          playoff_teams: isRoundRobinIndividual ? null : (formData.hasPlayoffs ? formData.playoffTeams : null),
          playoff_byes: formData.hasPlayoffs ? formData.playoffByes : null,
          has_playoffs: formData.hasPlayoffs,
          playoff_reseeding: formData.hasPlayoffs ? formData.playoffReseeding : false,
          playoff_qualifiers: isRoundRobinIndividual && formData.hasPlayoffs ? formData.playoffQualifiers : null,
          best_of: isRoundRobinIndividual ? formData.bestOf : 1,
          is_private: formData.isPrivate,
          access_code: formData.isPrivate ? formData.accessCode : null,
          is_dupr_required: formData.isDuprRequired,
          dupr_club_id: formData.duprClubId || null,
          dupr_club_name: formData.duprClubName || null,
          dupr_plus_required_subs: formData.isDuprPlusRequired && formData.duprPlusRequiredSubs.length > 0
            ? (formData.duprPlusRequiredSubs.includes('BASIC_L1') ? formData.duprPlusRequiredSubs : ['BASIC_L1', ...formData.duprPlusRequiredSubs])
            : [],
          groups_enabled: formData.groupsEnabled && !isRoundRobinIndividual,
          number_of_groups: formData.groupsEnabled && !isRoundRobinIndividual ? formData.numberOfGroups : null,
          teams_per_group_advancing: formData.groupsEnabled && !isRoundRobinIndividual && formData.hasPlayoffs ? formData.teamsPerGroupAdvancing : null,
          pool_play_enabled: formData.poolPlayEnabled && !isRoundRobinIndividual,
          teams_per_pool: formData.poolPlayEnabled && !isRoundRobinIndividual ? formData.teamsPerPool : null,
          games_per_pool: formData.poolPlayEnabled && !isRoundRobinIndividual ? formData.gamesPerPool : null,
          pool_advance_count: formData.poolPlayEnabled && !isRoundRobinIndividual ? formData.poolAdvanceCount : null,
          pool_bye_count: formData.poolPlayEnabled && !isRoundRobinIndividual ? formData.poolByeCount : null,
          tiebreaker_point_differential_first: formData.tiebreakerPointDifferentialFirst,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Tournament insert error:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });

        if (insertError.message.includes('row-level security') || insertError.message.includes('policy')) {
          setAuthError(true);
          throw new Error('Permission denied. Your session may have expired. Please log in again.');
        }
        throw insertError;
      }

      console.log('Tournament created successfully:', tournament.id);

      await authenticatedClient.from('tournament_participants').insert({
        tournament_id: tournament.id,
        user_id: userId,
        status: 'approved'
      });

      // Only create team slots for team-based tournaments
      if (!isRoundRobinIndividual) {
        const teamInserts = Array.from({ length: formData.expectedTeams }, (_, i) => ({
          tournament_id: tournament.id,
          team_number: i + 1,
        }));

        const { error: teamsError } = await authenticatedClient
          .from('tournament_teams')
          .insert(teamInserts);

        if (teamsError) throw teamsError;
      }

      router.push(`/dashboard/tournaments/${tournament.id}`);
    } catch (err: any) {
      console.error('Tournament creation error:', err);
      setError(err.message || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const generateAccessCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({ ...formData, accessCode: code });
  };

  const handleMobileFormatSelection = (format: 'round_robin_individual' | 'group_stage_playoffs') => {
    setFormData({ ...formData, format });
    setMobileStep(2);
  };

  const roundRobinGames = calculateGames(formData.expectedTeams, 'round_robin');
  const groupStageGames = calculateGames(formData.expectedTeams, 'group_stage_playoffs');

  // Mobile Step 1: Format Selection
  if (!isDesktop && mobileStep === 1) {
    return (
      <div className="min-h-screen bg-white md:hidden">
        <div className="container max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">GAME TYPE</h1>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => handleMobileFormatSelection('round_robin_individual')}
              className="w-full bg-white border-2 border-black hover:border-[#84c225] transition-all group"
            >
              <div className="bg-black text-white px-4 py-3 flex items-center gap-3">
                <Dumbbell className="h-6 w-6" />
                <span className="font-bold text-lg">STANDARD GAME</span>
              </div>
              <div className="p-4 text-left">
                <p className="text-sm text-gray-700 mb-3">
                  SCHEDULE GAMES, TRACK SCORES, AND BUILD OUT YOUR LEAGUE ON THE NTWRK APP
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  EX: TUESDAY NIGHT PICKUP, SATURDAY DRILL SESSION, WEEKEND PRIVATE LESSON
                </p>
                <div className="w-full bg-black text-white py-3 font-bold text-center">
                  CREATE GAME
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleMobileFormatSelection('group_stage_playoffs')}
              className="w-full bg-white border-2 border-black hover:border-[#84c225] transition-all group"
            >
              <div className="bg-[#84c225] text-white px-4 py-3 flex items-center gap-3">
                <Trophy className="h-6 w-6" />
                <span className="font-bold text-lg">TOURNAMENT</span>
              </div>
              <div className="p-4 text-left">
                <p className="text-sm text-gray-700 mb-3">
                  OFFICIAL LARGE-SCALE TOURNAMENTS. RUN EACH DIVISION AUTOMATICALLY ON THE NTWRK APP
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  EX: CUMBERLAND SENIOR TOURNAMENT
                </p>
                <div className="w-full bg-[#84c225] text-white py-3 font-bold text-center">
                  CREATE TOURNAMENT
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const poolPlayInvalid = formData.poolPlayEnabled && (() => {
    const numPools = formData.teamsPerPool >= 2 ? Math.ceil(formData.expectedTeams / formData.teamsPerPool) : 1;
    const totalAdvancing = formData.poolAdvanceCount * numPools;
    const byeTeams = formData.poolByeCount * numPools;
    return (
      formData.teamsPerPool < 2 ||
      (formData.teamsPerPool >= 2 && formData.gamesPerPool >= formData.teamsPerPool) ||
      (formData.teamsPerPool >= 2 && formData.poolAdvanceCount >= formData.teamsPerPool) ||
      (formData.hasPlayoffs && formData.poolAdvanceCount > 0 && formData.poolByeCount >= formData.poolAdvanceCount) ||
      (formData.hasPlayoffs && !validatePlayoffStructure(totalAdvancing, byeTeams))
    );
  })();

  return (
    <div className="container max-w-2xl py-8 mx-auto">
      <Card>
        <CardHeader>
          {!isDesktop && mobileStep === 2 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMobileStep(1)}
              className="mb-2 -ml-2 w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Game Type
            </Button>
          )}
          <CardTitle>Create Game</CardTitle>
          <CardDescription>Set up a new pickleball game</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{error}</p>
                    {authError && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReauthenticate}
                        className="mt-2"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Log In Again
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Only show format selector on desktop */}
            {isDesktop && (
              <div className="space-y-2">
                <Label htmlFor="format">Game Format *</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value: 'group_stage_playoffs' | 'round_robin_individual') =>
                    setFormData({ ...formData, format: value })
                  }
                >
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin_individual">Round Robin - Individual players compete in rotating matchups</SelectItem>
                    <SelectItem value="group_stage_playoffs">Tournament - Teams divided into groups, top teams advance to playoffs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Game Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Summer Pickleball Championship"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <span className={formData.date ? 'text-foreground' : 'text-muted-foreground'}>
                        {formData.date
                          ? format(parse(formData.date, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy')
                          : 'MM/DD/YYYY'}
                      </span>
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.date ? parse(formData.date, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(day) => {
                        setFormData({ ...formData, date: day ? format(day, 'yyyy-MM-dd') : '' });
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Start Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <span className={formData.startTime ? 'text-foreground' : 'text-muted-foreground'}>
                        {formData.startTime
                          ? (() => {
                              const [h, m] = formData.startTime.split(':').map(Number);
                              const period = h >= 12 ? 'PM' : 'AM';
                              const hour12 = h % 12 === 0 ? 12 : h % 12;
                              return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
                            })()
                          : 'HH:MM AM/PM'}
                      </span>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-3" align="start">
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1 flex-1">
                        <p className="text-xs font-medium text-muted-foreground text-center mb-1">Hour</p>
                        <div className="h-48 overflow-y-auto space-y-0.5 scrollbar-thin">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                            const [curH] = formData.startTime ? formData.startTime.split(':').map(Number) : [0];
                            const period = curH >= 12 ? 'PM' : 'AM';
                            const cur12 = curH % 12 === 0 ? 12 : curH % 12;
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => {
                                  const [, m] = formData.startTime ? formData.startTime.split(':').map(Number) : [0, 0];
                                  const isPM = curH >= 12;
                                  const newH = isPM ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
                                  setFormData({ ...formData, startTime: `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
                                }}
                                className={`w-full text-center text-sm py-1 rounded hover:bg-accent transition-colors ${cur12 === h ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
                              >
                                {h}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <p className="text-xs font-medium text-muted-foreground text-center mb-1">Min</p>
                        <div className="h-48 overflow-y-auto space-y-0.5 scrollbar-thin">
                          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                            const [, curM] = formData.startTime ? formData.startTime.split(':').map(Number) : [0, 0];
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  const [h] = formData.startTime ? formData.startTime.split(':').map(Number) : [9];
                                  setFormData({ ...formData, startTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
                                }}
                                className={`w-full text-center text-sm py-1 rounded hover:bg-accent transition-colors ${curM === m ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
                              >
                                {String(m).padStart(2, '0')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium text-muted-foreground text-center mb-1">AM/PM</p>
                        <div className="space-y-1">
                          {['AM', 'PM'].map((p) => {
                            const [curH] = formData.startTime ? formData.startTime.split(':').map(Number) : [0];
                            const curPeriod = curH >= 12 ? 'PM' : 'AM';
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  const [h, m] = formData.startTime ? formData.startTime.split(':').map(Number) : [9, 0];
                                  let newH = h;
                                  if (p === 'AM' && h >= 12) newH = h - 12;
                                  if (p === 'PM' && h < 12) newH = h + 12;
                                  setFormData({ ...formData, startTime: `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
                                }}
                                className={`w-full px-2 text-sm py-1 rounded hover:bg-accent transition-colors ${curPeriod === p ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Community Sports Center"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamFormat">Game Type *</Label>
              <Select
                value={formData.teamFormat}
                onValueChange={(value: 'singles' | 'doubles') =>
                  setFormData({ ...formData, teamFormat: value })
                }
              >
                <SelectTrigger id="teamFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="singles">Singles</SelectItem>
                  <SelectItem value="doubles">Doubles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.format !== 'round_robin_individual' && (
              <>
                {/* Pool Play — directly below Game Type */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="poolPlayEnabled" className={formData.groupsEnabled ? 'text-muted-foreground' : ''}>Include Pool Play</Label>
                    <p className="text-sm text-muted-foreground">
                      {formData.groupsEnabled ? 'Not available when Use Groups is enabled' : 'Divide teams into pools with limited games before playoffs'}
                    </p>
                  </div>
                  <Switch
                    id="poolPlayEnabled"
                    checked={formData.poolPlayEnabled}
                    disabled={formData.groupsEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, poolPlayEnabled: checked, groupsEnabled: checked ? false : formData.groupsEnabled })}
                  />
                </div>

                {formData.poolPlayEnabled && (() => {
                  const numPools = formData.teamsPerPool >= 2
                    ? Math.ceil(formData.expectedTeams / formData.teamsPerPool)
                    : 1;
                  const totalAdvancing = formData.poolAdvanceCount * numPools;
                  const byeTeams = formData.poolByeCount * numPools;
                  const playInTeams = totalAdvancing - byeTeams;
                  const poolPlayoffValid = validatePlayoffStructure(totalAdvancing, byeTeams);
                  const errTeamsPerPool = formData.teamsPerPool < 2;
                  const errGamesPerPool = formData.teamsPerPool >= 2 && formData.gamesPerPool >= formData.teamsPerPool;
                  const errAdvanceCount = formData.teamsPerPool >= 2 && formData.poolAdvanceCount >= formData.teamsPerPool;
                  const errByeCount = formData.poolAdvanceCount > 0 && formData.poolByeCount >= formData.poolAdvanceCount;
                  const errPlayoffStructure = !errAdvanceCount && !errTeamsPerPool && !poolPlayoffValid;

                  return (
                    <div className="pl-4 border-l-2 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="teamsPerPool">Teams per Pool *</Label>
                        <Input
                          id="teamsPerPool"
                          type="number"
                          min={1}
                          value={formData.teamsPerPool || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setFormData({ ...formData, teamsPerPool: val });
                          }}
                          className={errTeamsPerPool ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        {errTeamsPerPool ? (
                          <p className="text-sm text-red-500 font-medium">Must be at least 2 teams per pool.</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {numPools} pool{numPools !== 1 ? 's' : ''} of {formData.teamsPerPool} teams
                            {formData.expectedTeams % formData.teamsPerPool !== 0 && (
                              <span className="text-amber-600"> (last pool may have fewer teams)</span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gamesPerPool">Games per Pool *</Label>
                        <Input
                          id="gamesPerPool"
                          type="number"
                          min={1}
                          value={formData.gamesPerPool || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setFormData({ ...formData, gamesPerPool: val });
                          }}
                          className={errGamesPerPool ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        {errGamesPerPool ? (
                          <p className="text-sm text-red-500 font-medium">Must be less than teams per pool ({formData.teamsPerPool}).</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Each team plays {formData.gamesPerPool} different opponent{formData.gamesPerPool !== 1 ? 's' : ''} in their pool
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="poolAdvanceCount">Teams Advancing per Pool *</Label>
                        <Input
                          id="poolAdvanceCount"
                          type="number"
                          min={1}
                          value={formData.poolAdvanceCount || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setFormData({ ...formData, poolAdvanceCount: val });
                          }}
                          className={errAdvanceCount ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        {errAdvanceCount ? (
                          <p className="text-sm text-red-500 font-medium">Must be less than teams per pool — at least one team must be eliminated.</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Top {formData.poolAdvanceCount} team{formData.poolAdvanceCount !== 1 ? 's' : ''} from each pool advance — {totalAdvancing} teams total
                          </p>
                        )}
                      </div>

                      {formData.hasPlayoffs && (
                      <div className="space-y-2">
                        <Label htmlFor="poolByeCount">Byes per Pool</Label>
                        <Input
                          id="poolByeCount"
                          type="number"
                          min={0}
                          value={formData.poolByeCount || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value));
                            setFormData({ ...formData, poolByeCount: val });
                          }}
                          className={(errByeCount || errPlayoffStructure) ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        {errByeCount ? (
                          <p className="text-sm text-red-500 font-medium">Byes per pool must be less than teams advancing per pool ({formData.poolAdvanceCount}).</p>
                        ) : errPlayoffStructure ? (
                          <p className="text-sm text-red-500 font-medium">
                            {totalAdvancing} advancing with {byeTeams} bye{byeTeams !== 1 ? 's' : ''} leaves {playInTeams} play-in teams — must be even. Adjust byes or advancing count.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {formData.poolByeCount === 0
                              ? `All ${totalAdvancing} advancing teams play in the first playoff round`
                              : `Top ${formData.poolByeCount} team${formData.poolByeCount !== 1 ? 's' : ''} from each pool get a bye — ${byeTeams} byes total, ${playInTeams} teams play in first round`}
                          </p>
                        )}
                      </div>
                      )}

                      {formData.teamsPerPool >= 2 && formData.poolAdvanceCount < formData.teamsPerPool && formData.gamesPerPool < formData.teamsPerPool && (
                        <Alert className={!poolPlayoffValid ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : ''}>
                          <Info className={`h-4 w-4 ${!poolPlayoffValid ? 'text-red-500' : ''}`} />
                          <AlertDescription>
                            <strong>Pool structure:</strong> {numPools} pool{numPools !== 1 ? 's' : ''} of {formData.teamsPerPool} teams
                            {' → '}each team plays {formData.gamesPerPool} opponent{formData.gamesPerPool !== 1 ? 's' : ''}
                            {' → '}top {formData.poolAdvanceCount} per pool advance ({totalAdvancing} total)
                            {formData.poolByeCount > 0
                              ? ` → ${formData.poolByeCount} per pool get a bye (${byeTeams} total), ${playInTeams} play first round`
                              : ' → all advancing teams play first round'}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {formData.format === 'round_robin_individual' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="playerCapacity">Number of Players *</Label>
                  <Select
                    value={formData.playerCapacity.toString()}
                    onValueChange={(value) => setFormData({ ...formData, playerCapacity: parseInt(value) })}
                  >
                    <SelectTrigger id="playerCapacity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 19 }, (_, i) => i + 2).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} Players
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bestOf">Best of *</Label>
                  <Select
                    value={formData.bestOf.toString()}
                    onValueChange={(value) => setFormData({ ...formData, bestOf: parseInt(value) as 1 | 3 | 5 })}
                  >
                    <SelectTrigger id="bestOf">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Best of 1</SelectItem>
                      <SelectItem value="3">Best of 3</SelectItem>
                      <SelectItem value="5">Best of 5</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Number of games per match
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="expectedTeams">Expected Teams *</Label>
                  <Select
                    value={formData.expectedTeams.toString()}
                    onValueChange={(value) => setFormData({ ...formData, expectedTeams: parseInt(value) })}
                  >
                    <SelectTrigger id="expectedTeams">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 39 }, (_, i) => i + 2).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} Teams
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {shouldRecommendGroups() && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      With {formData.expectedTeams} teams, recommend using Groups! Full round robin = {roundRobinGames} games,
                      2 groups = {groupStageGames} group games+playoffs.
                    </AlertDescription>
                  </Alert>
                )}


                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="groupsEnabled" className={formData.poolPlayEnabled ? 'text-muted-foreground' : ''}>Use Groups</Label>
                    <p className="text-sm text-muted-foreground">
                      {formData.poolPlayEnabled ? 'Not available when Pool Play is enabled' : 'Divide teams into groups for initial round-robin play'}
                    </p>
                  </div>
                  <Switch
                    id="groupsEnabled"
                    checked={formData.groupsEnabled}
                    disabled={formData.poolPlayEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, groupsEnabled: checked, poolPlayEnabled: checked ? false : formData.poolPlayEnabled })}
                  />
                </div>

                {formData.groupsEnabled && (
                  <>
                    <div className="space-y-2 pl-4 border-l-2">
                      <Label htmlFor="numberOfGroups">Number of Groups *</Label>
                      <Select
                        value={formData.numberOfGroups.toString()}
                        onValueChange={(value) => setFormData({ ...formData, numberOfGroups: parseInt(value) })}
                      >
                        <SelectTrigger id="numberOfGroups">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 Groups</SelectItem>
                          <SelectItem value="3">3 Groups</SelectItem>
                          <SelectItem value="4">4 Groups</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const teamsPerGroup = Math.floor(formData.expectedTeams / formData.numberOfGroups);
                          const remainder = formData.expectedTeams % formData.numberOfGroups;
                          if (remainder === 0) {
                            return `${formData.numberOfGroups} groups of ${teamsPerGroup} teams each`;
                          } else {
                            return `${remainder} group${remainder > 1 ? 's' : ''} with ${teamsPerGroup + 1} teams, ${formData.numberOfGroups - remainder} group${formData.numberOfGroups - remainder > 1 ? 's' : ''} with ${teamsPerGroup} teams`;
                          }
                        })()}
                      </p>
                    </div>

                    {formData.expectedTeams < formData.numberOfGroups * 2 && (
                      <Alert variant="destructive" className="ml-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Need at least 2 teams per group. Reduce number of groups or increase number of teams.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </>
            )}

            {formData.format === 'round_robin_individual' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="hasPlayoffs">Include Playoffs</Label>
                    <p className="text-sm text-muted-foreground">
                      Top players advance to single-elimination playoff bracket
                    </p>
                  </div>
                  <Switch
                    id="hasPlayoffs"
                    checked={formData.hasPlayoffs}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasPlayoffs: checked })}
                  />
                </div>

                {formData.hasPlayoffs && (
                  <>
                    <div className="space-y-2 pl-4 border-l-2">
                      <Label htmlFor="playoffQualifiers">Playoff Qualifiers</Label>
                      <Select
                        value={formData.playoffQualifiers.toString()}
                        onValueChange={(value) => setFormData({ ...formData, playoffQualifiers: parseInt(value) })}
                      >
                        <SelectTrigger id="playoffQualifiers">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 4, 6, 8].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} {formData.teamFormat === 'singles' ? 'Players' : 'Teams'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Number of top performers who advance to playoffs
                      </p>
                    </div>

                    <div className="space-y-2 pl-4 border-l-2">
                      <Label htmlFor="playoffByes">Top Seeds with Bye</Label>
                      <Select
                        value={formData.playoffByes.toString()}
                        onValueChange={(value) => setFormData({ ...formData, playoffByes: parseInt(value) })}
                      >
                        <SelectTrigger id="playoffByes">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No Byes (All play Round 1)</SelectItem>
                          {formData.playoffQualifiers >= 4 && (
                            <SelectItem value="2">Top 2 seeds get bye</SelectItem>
                          )}
                          {formData.playoffQualifiers >= 6 && (
                            <SelectItem value="4">Top 4 seeds get bye</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between pl-4 border-l-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="playoffReseedingIndividual">Reseed Between Rounds</Label>
                        <p className="text-sm text-muted-foreground">
                          Re-rank remaining players between playoff rounds so top seeds avoid each other early
                        </p>
                      </div>
                      <Switch
                        id="playoffReseedingIndividual"
                        checked={formData.playoffReseeding}
                        onCheckedChange={(checked) => setFormData({ ...formData, playoffReseeding: checked })}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {formData.format === 'group_stage_playoffs' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="hasPlayoffsGroupStage">Include Playoffs</Label>
                    <p className="text-sm text-muted-foreground">
                      Top teams advance to single-elimination playoff bracket
                    </p>
                  </div>
                  <Switch
                    id="hasPlayoffsGroupStage"
                    checked={formData.hasPlayoffs}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasPlayoffs: checked })}
                  />
                </div>

                {formData.hasPlayoffs && (
                  <>
                    {formData.groupsEnabled ? (
                      <div className="space-y-2 pl-4 border-l-2">
                        <Label htmlFor="teamsPerGroupAdvancing">Teams Advancing Per Group *</Label>
                        <Select
                          value={formData.teamsPerGroupAdvancing.toString()}
                          onValueChange={(value) => {
                            const teamsPerGroup = parseInt(value);
                            const totalPlayoffTeams = teamsPerGroup * formData.numberOfGroups;
                            setFormData({
                              ...formData,
                              teamsPerGroupAdvancing: teamsPerGroup,
                              playoffTeams: totalPlayoffTeams,
                              playoffByes: Math.min(formData.playoffByes, totalPlayoffTeams - 2)
                            });
                          }}
                        >
                          <SelectTrigger id="teamsPerGroupAdvancing">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].filter(num => {
                              const minTeamsPerGroup = Math.floor(formData.expectedTeams / formData.numberOfGroups);
                              return num <= minTeamsPerGroup;
                            }).map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                Top {num} {num === 1 ? 'team' : 'teams'} from each group
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          {formData.teamsPerGroupAdvancing * formData.numberOfGroups} total teams in playoff bracket
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 pl-4 border-l-2">
                        <Label htmlFor="playoffTeams">Playoff Teams *</Label>
                        <Select
                          value={formData.playoffTeams.toString()}
                          onValueChange={(value) => {
                            const playoffTeams = parseInt(value);
                            setFormData({
                              ...formData,
                              playoffTeams,
                              playoffByes: Math.min(formData.playoffByes, playoffTeams - 2)
                            });
                          }}
                        >
                          <SelectTrigger id="playoffTeams">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} Teams
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          Number of teams that advance to playoffs
                        </p>
                      </div>
                    )}

                    {(() => {
                      const gsPlayoffValid = validatePlayoffStructure(formData.playoffTeams, formData.playoffByes);
                      return (
                        <div className="space-y-2 pl-4 border-l-2">
                          <Label htmlFor="playoffByes">Top Teams with Bye</Label>
                          <Select
                            value={formData.playoffByes.toString()}
                            onValueChange={(value) => setFormData({ ...formData, playoffByes: parseInt(value) })}
                          >
                            <SelectTrigger id="playoffByes" className={!gsPlayoffValid ? 'border-red-500 ring-red-500' : ''}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No Byes (All teams play Round 1)</SelectItem>
                              {formData.playoffTeams >= 4 && (
                                <SelectItem value="2">Top 2 seeds get bye</SelectItem>
                              )}
                              {formData.playoffTeams >= 6 && (
                                <SelectItem value="4">Top 4 seeds get bye</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">
                            {formData.playoffByes === 0
                              ? 'All playoff teams start in the first round'
                              : formData.playoffByes === 2 && formData.playoffTeams === 4
                              ? 'Teams 3-4 play first round, winners face Teams 1-2 in finals'
                              : formData.playoffByes === 2 && formData.playoffTeams === 6
                              ? 'Teams 3-6 play first round (2 matches), winners face Teams 1-2 in semifinals'
                              : formData.playoffByes === 2 && formData.playoffTeams === 8
                              ? 'Teams 3-8 play first round (3 matches), winners + Teams 1-2 advance'
                              : formData.playoffByes === 4 && formData.playoffTeams === 6
                              ? 'Teams 5-6 play first round, winner + Teams 1-4 in next round'
                              : formData.playoffByes === 4 && formData.playoffTeams === 8
                              ? 'Teams 5-8 play first round (2 matches), winners face Teams 1-4 in quarterfinals'
                              : `Top ${formData.playoffByes} seeds automatically advance to next round`
                            }
                          </p>
                          {!gsPlayoffValid && (
                            <p className="text-sm text-red-500 font-medium border-b-2 border-red-500 pb-1">
                              {formData.playoffTeams} playoff teams with {formData.playoffByes} bye{formData.playoffByes !== 1 ? 's' : ''} cannot produce a valid bracket. Adjust playoff teams or bye count.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between pl-4 border-l-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="playoffReseedingGroupStage">Reseed Between Rounds</Label>
                        <p className="text-sm text-muted-foreground">
                          Re-rank remaining teams between playoff rounds so top seeds avoid each other early
                        </p>
                      </div>
                      <Switch
                        id="playoffReseedingGroupStage"
                        checked={formData.playoffReseeding}
                        onCheckedChange={(checked) => setFormData({ ...formData, playoffReseeding: checked })}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tiebreakerPointDifferentialFirst">Tiebreaker: Point Differential</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.tiebreakerPointDifferentialFirst
                      ? 'When tied on wins, point differential is used before head-to-head.'
                      : 'When tied on wins, head-to-head is used before point differential.'}
                  </p>
                </div>
                <Switch
                  id="tiebreakerPointDifferentialFirst"
                  checked={formData.tiebreakerPointDifferentialFirst}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, tiebreakerPointDifferentialFirst: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isDuprRequired">DUPR Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Only users with DUPR accounts can join
                  </p>
                </div>
                <Switch
                  id="isDuprRequired"
                  checked={formData.isDuprRequired}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    isDuprRequired: checked,
                    isDuprPlusRequired: checked ? formData.isDuprPlusRequired : false,
                    duprPlusRequiredSubs: checked ? formData.duprPlusRequiredSubs : []
                  })}
                />
              </div>

              {formData.isDuprRequired && (
                <div className="space-y-2 pl-4 border-l-2">
                  <Label htmlFor="duprClub">DUPR Club <span className="text-destructive">*</span></Label>
                  {clubsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading your DUPR clubs...
                    </div>
                  ) : clubsError ? (
                    <div className="space-y-3">
                      <Alert variant={clubsError.includes('No DUPR clubs found') ? 'default' : 'destructive'}>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="text-sm">{clubsError}</p>
                            <div className="flex gap-2">
                              {clubsError.includes('No DUPR account') ? (
                                <Button type="button" variant="outline" size="sm" asChild>
                                  <Link href="/dashboard/profile">Connect DUPR Account</Link>
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchDuprClubs}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Retry
                                  </Button>
                                  {clubsError.includes('authentication failed') && (
                                    <Button type="button" variant="outline" size="sm" asChild>
                                      <Link href="/dashboard/profile">Reconnect DUPR</Link>
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              A DUPR club must be selected to create a DUPR-required tournament.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <Select
                      value={formData.duprClubId || '_none'}
                      onValueChange={(value) => {
                        if (value === '_none') {
                          setFormData({ ...formData, duprClubId: '', duprClubName: '' });
                        } else {
                          const club = duprClubs.find((c) => c.id === value);
                          setFormData({
                            ...formData,
                            duprClubId: value,
                            duprClubName: club?.name ?? ''
                          });
                        }
                      }}
                    >
                      <SelectTrigger id="duprClub">
                        <SelectValue placeholder="Select a club" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {duprClubs.map((club) => (
                          <SelectItem key={club.id} value={club.id}>
                            {club.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!clubsError && duprClubs.length === 0 && !clubsLoading && (
                    <p className="text-sm text-muted-foreground">No DUPR clubs found for your account.</p>
                  )}
                  {clubsCached && clubsLastSynced && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                            Showing cached clubs
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                            Last synced: {new Date(clubsLastSynced).toLocaleString()}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            DUPR API is temporarily unavailable. Using previously saved data.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="isDuprPlusRequired">DUPR+ Required</Label>
                      <p className="text-sm text-muted-foreground">
                        Require a specific DUPR subscription tier to join
                      </p>
                    </div>
                    <Switch
                      id="isDuprPlusRequired"
                      checked={formData.isDuprPlusRequired}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        isDuprPlusRequired: checked,
                        duprPlusRequiredSubs: checked ? formData.duprPlusRequiredSubs : []
                      })}
                    />
                  </div>

                  {formData.isDuprPlusRequired && (
                    <div className="mt-2 space-y-2">
                      <Label>Required Subscription Tier</Label>
                      <p className="text-xs text-muted-foreground">Players must hold this subscription to join.</p>
                      <div className="space-y-2 pt-1">
                        {[
                          { label: 'Premium', value: 'PREMIUM_L1', description: 'DUPR Premium subscription' },
                          { label: 'Verified', value: 'VERIFIED_L1', description: 'DUPR Verified subscription' },
                        ].map(({ label, value, description }) => {
                          const isChecked = formData.duprPlusRequiredSubs.includes(value);
                          return (
                            <div
                              key={value}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${isChecked ? 'border-green-500 bg-green-50 dark:bg-green-950/50' : 'border-border hover:bg-muted/50'}`}
                              onClick={() => {
                                const updated = isChecked
                                  ? formData.duprPlusRequiredSubs.filter((s) => s !== value)
                                  : [...formData.duprPlusRequiredSubs, value];
                                setFormData({ ...formData, duprPlusRequiredSubs: updated });
                              }}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-green-500 border-green-500' : 'border-muted-foreground'}`}>
                                {isChecked && (
                                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-medium">{label}</span>
                                <p className="text-xs text-muted-foreground">{description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {formData.duprPlusRequiredSubs.filter(s => s !== 'BASIC_L1').length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Select at least one tier, or disable DUPR+ Required.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isPrivate">Private Tournament</Label>
                  <p className="text-sm text-muted-foreground">
                    Require approval or access code to join
                  </p>
                </div>
                <Switch
                  id="isPrivate"
                  checked={formData.isPrivate}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: checked })}
                />
              </div>

              {formData.isPrivate && (
                <div className="space-y-2 pl-4 border-l-2">
                  <Label htmlFor="accessCode">Access Code (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accessCode"
                      value={formData.accessCode}
                      onChange={(e) => setFormData({ ...formData, accessCode: e.target.value })}
                      placeholder="Enter or generate code"
                    />
                    <Button type="button" variant="outline" onClick={generateAccessCode}>
                      Generate
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Users can join with this code or request access
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !!poolPlayInvalid} className="flex-1">
                {loading ? 'Creating...' : 'Create Tournament'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
