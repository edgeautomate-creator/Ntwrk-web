'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, isValid } from 'date-fns';
import { CircleAlert as AlertCircle, Info, RefreshCw, Loader as Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validatePlayoffStructure } from '@/lib/tournament-validation';
import type { Tournament, TournamentTeam } from '@/app/dashboard/tournaments/[id]/page';

interface TournamentTeamSettingsFormProps {
  tournament: Tournament;
  teams: TournamentTeam[];
  onSaved?: () => Promise<void>;
}

function teamHasAnyPlayer(team: TournamentTeam): boolean {
  return !!(team.player1_name || team.player2_name);
}

function teamIsEmpty(team: TournamentTeam): boolean {
  return !team.player1_name && !team.player2_name;
}

export function TournamentTeamSettingsForm({
  tournament,
  teams,
  onSaved,
}: TournamentTeamSettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duprClubs, setDuprClubs] = useState<{ id: string; name: string }[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState('');
  const [clubsCached, setClubsCached] = useState(false);
  const [clubsLastSynced, setClubsLastSynced] = useState<string | null>(null);

  const subs = tournament.dupr_plus_required_subs ?? [];
  const nonBasicSubs = subs.filter((s) => s !== 'BASIC_L1');

  const [formData, setFormData] = useState({
    name: tournament.name,
    date: tournament.date ?? '',
    startTime: tournament.start_time ?? '',
    location: tournament.location ?? '',
    teamFormat: (tournament.team_format ?? 'doubles') as 'singles' | 'doubles',
    expectedTeams: tournament.expected_teams ?? 4,
    playoffTeams: tournament.playoff_teams ?? 2,
    playoffByes: tournament.playoff_byes ?? 0,
    hasPlayoffs: tournament.has_playoffs ?? false,
    playoffReseeding: tournament.playoff_reseeding ?? false,
    groupsEnabled: tournament.groups_enabled ?? false,
    numberOfGroups: tournament.number_of_groups ?? 2,
    teamsPerGroupAdvancing: tournament.teams_per_group_advancing ?? 2,
    poolPlayEnabled: tournament.pool_play_enabled ?? false,
    teamsPerPool: tournament.teams_per_pool ?? 4,
    gamesPerPool: tournament.games_per_pool ?? 2,
    poolAdvanceCount: tournament.pool_advance_count ?? 2,
    poolByeCount: tournament.pool_bye_count ?? 0,
    tiebreakerPointDifferentialFirst: tournament.tiebreaker_point_differential_first ?? false,
    isDuprRequired: tournament.is_dupr_required ?? false,
    duprClubId: tournament.dupr_club_id ?? '',
    duprClubName: tournament.dupr_club_name ?? '',
    isDuprPlusRequired: nonBasicSubs.length > 0,
    duprPlusRequiredSubs: nonBasicSubs,
    isPrivate: tournament.is_private ?? false,
    accessCode: tournament.access_code ?? '',
  });

  useEffect(() => {
    const updatedSubs = tournament.dupr_plus_required_subs ?? [];
    const updatedNonBasicSubs = updatedSubs.filter((s) => s !== 'BASIC_L1');
    setFormData({
      name: tournament.name,
      date: tournament.date ?? '',
      startTime: tournament.start_time ?? '',
      location: tournament.location ?? '',
      teamFormat: (tournament.team_format ?? 'doubles') as 'singles' | 'doubles',
      expectedTeams: tournament.expected_teams ?? 4,
      playoffTeams: tournament.playoff_teams ?? 2,
      playoffByes: tournament.playoff_byes ?? 0,
      hasPlayoffs: tournament.has_playoffs ?? false,
      playoffReseeding: tournament.playoff_reseeding ?? false,
      groupsEnabled: tournament.groups_enabled ?? false,
      numberOfGroups: tournament.number_of_groups ?? 2,
      teamsPerGroupAdvancing: tournament.teams_per_group_advancing ?? 2,
      poolPlayEnabled: tournament.pool_play_enabled ?? false,
      teamsPerPool: tournament.teams_per_pool ?? 4,
      gamesPerPool: tournament.games_per_pool ?? 2,
      poolAdvanceCount: tournament.pool_advance_count ?? 2,
      poolByeCount: tournament.pool_bye_count ?? 0,
      tiebreakerPointDifferentialFirst: tournament.tiebreaker_point_differential_first ?? false,
      isDuprRequired: tournament.is_dupr_required ?? false,
      duprClubId: tournament.dupr_club_id ?? '',
      duprClubName: tournament.dupr_club_name ?? '',
      isDuprPlusRequired: updatedNonBasicSubs.length > 0,
      duprPlusRequiredSubs: updatedNonBasicSubs,
      isPrivate: tournament.is_private ?? false,
      accessCode: tournament.access_code ?? '',
    });
  }, [
    tournament.id,
    tournament.name,
    tournament.date,
    tournament.start_time,
    tournament.location,
    tournament.team_format,
    tournament.expected_teams,
    tournament.playoff_teams,
    tournament.playoff_byes,
    tournament.has_playoffs,
    tournament.playoff_reseeding,
    tournament.groups_enabled,
    tournament.number_of_groups,
    tournament.teams_per_group_advancing,
    tournament.pool_play_enabled,
    tournament.teams_per_pool,
    tournament.games_per_pool,
    tournament.pool_advance_count,
    tournament.pool_bye_count,
    tournament.tiebreaker_point_differential_first,
    tournament.is_dupr_required,
    tournament.dupr_club_id,
    tournament.dupr_club_name,
    tournament.is_private,
    tournament.access_code,
    tournament.dupr_plus_required_subs,
  ]);

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
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 400 && data.error?.includes('No DUPR account linked')) {
          setClubsError('No DUPR account connected.');
        } else if (response.status === 401) {
          setClubsError(data.error || 'DUPR authentication failed. Please reconnect your DUPR account.');
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
    } catch {
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

  const teamsWithAnyPlayer = teams.filter(teamHasAnyPlayer).length;

  const calculateGames = (teamCount: number) => {
    const teamsPerGroup = Math.ceil(teamCount / 2);
    const groupGames = 2 * ((teamsPerGroup * (teamsPerGroup - 1)) / 2);
    const playoffGames = formData.playoffTeams - 1;
    return groupGames + playoffGames;
  };

  const shouldRecommendGroups = () => {
    const teamCount = formData.expectedTeams;
    const roundRobinGames = (teamCount * (teamCount - 1)) / 2;
    return teamCount >= 7 && roundRobinGames > 15;
  };

  const roundRobinGames = (formData.expectedTeams * (formData.expectedTeams - 1)) / 2;
  const groupStageGames = calculateGames(formData.expectedTeams);

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

  const gsPlayoffValid = !formData.hasPlayoffs || formData.poolPlayEnabled || validatePlayoffStructure(formData.playoffTeams, formData.playoffByes);

  const generateAccessCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({ ...formData, accessCode: code });
  };

  const syncTournamentTeams = async (expectedTeams: number) => {
    const maxTeamNumber = teams.length > 0 ? Math.max(...teams.map((t) => t.team_number)) : 0;

    if (expectedTeams > maxTeamNumber) {
      const inserts = Array.from({ length: expectedTeams - maxTeamNumber }, (_, i) => ({
        tournament_id: tournament.id,
        team_number: maxTeamNumber + i + 1,
      }));
      const { error: insertError } = await supabase.from('tournament_teams').insert(inserts);
      if (insertError) throw insertError;
    }

    if (expectedTeams < maxTeamNumber) {
      const teamsBeyondLimit = teams.filter((t) => t.team_number > expectedTeams);
      const registeredBeyondLimit = teamsBeyondLimit.filter((t) => !teamIsEmpty(t));
      if (registeredBeyondLimit.length > 0) {
        throw new Error(
          `Cannot reduce to ${expectedTeams} teams — ${registeredBeyondLimit.length} team${registeredBeyondLimit.length !== 1 ? 's' : ''} beyond that limit already have players registered.`
        );
      }
      const emptyIds = teamsBeyondLimit.filter(teamIsEmpty).map((t) => t.id);
      if (emptyIds.length > 0) {
        const { error: deleteError } = await supabase.from('tournament_teams').delete().in('id', emptyIds);
        if (deleteError) throw deleteError;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Game name is required.');
      return;
    }

    if (formData.expectedTeams < teamsWithAnyPlayer) {
      setError(`Expected teams cannot be less than the ${teamsWithAnyPlayer} team${teamsWithAnyPlayer !== 1 ? 's' : ''} that already have players registered.`);
      return;
    }

    if (formData.isDuprRequired && !formData.duprClubId) {
      setError('A DUPR club must be selected for DUPR-required tournaments.');
      return;
    }

    if (formData.isDuprPlusRequired && formData.duprPlusRequiredSubs.length === 0) {
      setError('Select at least one DUPR+ subscription tier, or disable DUPR+ Required.');
      return;
    }

    if (formData.hasPlayoffs && !formData.poolPlayEnabled) {
      if (!validatePlayoffStructure(formData.playoffTeams, formData.playoffByes)) {
        setError(`${formData.playoffTeams} playoff teams with ${formData.playoffByes} bye${formData.playoffByes !== 1 ? 's' : ''} cannot produce a valid bracket. Please adjust the playoff settings.`);
        return;
      }
    }

    if (formData.poolPlayEnabled) {
      const numPools = formData.teamsPerPool >= 2 ? Math.ceil(formData.expectedTeams / formData.teamsPerPool) : 1;
      const totalAdvancing = formData.poolAdvanceCount * numPools;
      const byeTeams = formData.poolByeCount * numPools;
      if (!validatePlayoffStructure(totalAdvancing, byeTeams)) {
        setError(`${totalAdvancing} advancing teams with ${byeTeams} bye${byeTeams !== 1 ? 's' : ''} cannot produce a valid playoff bracket. Please adjust the pool play settings.`);
        return;
      }
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          name: formData.name.trim(),
          date: formData.date || null,
          start_time: formData.startTime || null,
          location: formData.location || null,
          team_format: formData.teamFormat,
          expected_teams: formData.expectedTeams,
          playoff_teams: formData.hasPlayoffs ? formData.playoffTeams : null,
          playoff_byes: formData.hasPlayoffs ? formData.playoffByes : null,
          has_playoffs: formData.hasPlayoffs,
          playoff_reseeding: formData.hasPlayoffs ? formData.playoffReseeding : false,
          best_of: 1,
          is_private: formData.isPrivate,
          access_code: formData.isPrivate ? formData.accessCode || null : null,
          is_dupr_required: formData.isDuprRequired,
          dupr_club_id: formData.duprClubId || null,
          dupr_club_name: formData.duprClubName || null,
          dupr_plus_required_subs:
            formData.isDuprPlusRequired && formData.duprPlusRequiredSubs.length > 0
              ? formData.duprPlusRequiredSubs.includes('BASIC_L1')
                ? formData.duprPlusRequiredSubs
                : ['BASIC_L1', ...formData.duprPlusRequiredSubs]
              : [],
          groups_enabled: formData.groupsEnabled,
          number_of_groups: formData.groupsEnabled ? formData.numberOfGroups : null,
          teams_per_group_advancing: formData.groupsEnabled && formData.hasPlayoffs ? formData.teamsPerGroupAdvancing : null,
          pool_play_enabled: formData.poolPlayEnabled,
          teams_per_pool: formData.poolPlayEnabled ? formData.teamsPerPool : null,
          games_per_pool: formData.poolPlayEnabled ? formData.gamesPerPool : null,
          pool_advance_count: formData.poolPlayEnabled ? formData.poolAdvanceCount : null,
          pool_bye_count: formData.poolPlayEnabled ? formData.poolByeCount : null,
          tiebreaker_point_differential_first: formData.tiebreakerPointDifferentialFirst,
        })
        .eq('id', tournament.id);

      if (updateError) throw updateError;

      await syncTournamentTeams(formData.expectedTeams);

      toast({ title: 'Settings saved', description: 'Tournament settings updated successfully.' });
      if (onSaved) await onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Settings</CardTitle>
        <CardDescription>
          Edit tournament details. After the schedule exists, use Rebuild Schedule on the Teams tab so remaining rounds match roster changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="team-settings-name">Game Name *</Label>
            <Input
              id="team-settings-name"
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
                      {formData.date && isValid(parse(formData.date, 'yyyy-MM-dd', new Date()))
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
            <Label htmlFor="team-settings-location">Location</Label>
            <Input
              id="team-settings-location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Community Sports Center"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-settings-teamFormat">Game Type *</Label>
            <Select
              value={formData.teamFormat}
              onValueChange={(value: 'singles' | 'doubles') =>
                setFormData({ ...formData, teamFormat: value })
              }
            >
              <SelectTrigger id="team-settings-teamFormat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Singles</SelectItem>
                <SelectItem value="doubles">Doubles</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="team-settings-poolPlayEnabled" className={formData.groupsEnabled ? 'text-muted-foreground' : ''}>
                Include Pool Play
              </Label>
              <p className="text-sm text-muted-foreground">
                {formData.groupsEnabled ? 'Not available when Use Groups is enabled' : 'Divide teams into pools with limited games before playoffs'}
              </p>
            </div>
            <Switch
              id="team-settings-poolPlayEnabled"
              checked={formData.poolPlayEnabled}
              disabled={formData.groupsEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, poolPlayEnabled: checked, groupsEnabled: checked ? false : formData.groupsEnabled })
              }
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
                  <Label htmlFor="team-settings-teamsPerPool">Teams per Pool *</Label>
                  <Input
                    id="team-settings-teamsPerPool"
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
                  <Label htmlFor="team-settings-gamesPerPool">Games per Pool *</Label>
                  <Input
                    id="team-settings-gamesPerPool"
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
                  <Label htmlFor="team-settings-poolAdvanceCount">Teams Advancing per Pool *</Label>
                  <Input
                    id="team-settings-poolAdvanceCount"
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
                    <Label htmlFor="team-settings-poolByeCount">Byes per Pool</Label>
                    <Input
                      id="team-settings-poolByeCount"
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

          <div className="space-y-2">
            <Label htmlFor="team-settings-expectedTeams">Expected Teams *</Label>
            <Select
              value={formData.expectedTeams.toString()}
              onValueChange={(value) => setFormData({ ...formData, expectedTeams: parseInt(value) })}
            >
              <SelectTrigger id="team-settings-expectedTeams">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 39 }, (_, i) => i + 2).map((num) => (
                  <SelectItem key={num} value={num.toString()} disabled={num < teamsWithAnyPlayer}>
                    {num} Teams{num < teamsWithAnyPlayer ? ' (too few)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamsWithAnyPlayer > 0 && (
              <p className="text-sm text-muted-foreground">
                {teamsWithAnyPlayer} team{teamsWithAnyPlayer !== 1 ? 's' : ''} already have players registered
              </p>
            )}
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
              <Label htmlFor="team-settings-groupsEnabled" className={formData.poolPlayEnabled ? 'text-muted-foreground' : ''}>
                Use Groups
              </Label>
              <p className="text-sm text-muted-foreground">
                {formData.poolPlayEnabled ? 'Not available when Pool Play is enabled' : 'Divide teams into groups for initial round-robin play'}
              </p>
            </div>
            <Switch
              id="team-settings-groupsEnabled"
              checked={formData.groupsEnabled}
              disabled={formData.poolPlayEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, groupsEnabled: checked, poolPlayEnabled: checked ? false : formData.poolPlayEnabled })
              }
            />
          </div>

          {formData.groupsEnabled && (
            <>
              <div className="space-y-2 pl-4 border-l-2">
                <Label htmlFor="team-settings-numberOfGroups">Number of Groups *</Label>
                <Select
                  value={formData.numberOfGroups.toString()}
                  onValueChange={(value) => setFormData({ ...formData, numberOfGroups: parseInt(value) })}
                >
                  <SelectTrigger id="team-settings-numberOfGroups">
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
                    }
                    return `${remainder} group${remainder > 1 ? 's' : ''} with ${teamsPerGroup + 1} teams, ${formData.numberOfGroups - remainder} group${formData.numberOfGroups - remainder > 1 ? 's' : ''} with ${teamsPerGroup} teams`;
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

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="team-settings-hasPlayoffs">Include Playoffs</Label>
              <p className="text-sm text-muted-foreground">
                Top teams advance to single-elimination playoff bracket
              </p>
            </div>
            <Switch
              id="team-settings-hasPlayoffs"
              checked={formData.hasPlayoffs}
              onCheckedChange={(checked) => setFormData({ ...formData, hasPlayoffs: checked })}
            />
          </div>

          {formData.hasPlayoffs && (
            <>
              {formData.groupsEnabled ? (
                <div className="space-y-2 pl-4 border-l-2">
                  <Label htmlFor="team-settings-teamsPerGroupAdvancing">Teams Advancing Per Group *</Label>
                  <Select
                    value={formData.teamsPerGroupAdvancing.toString()}
                    onValueChange={(value) => {
                      const teamsPerGroup = parseInt(value);
                      const totalPlayoffTeams = teamsPerGroup * formData.numberOfGroups;
                      setFormData({
                        ...formData,
                        teamsPerGroupAdvancing: teamsPerGroup,
                        playoffTeams: totalPlayoffTeams,
                        playoffByes: Math.min(formData.playoffByes, totalPlayoffTeams - 2),
                      });
                    }}
                  >
                    <SelectTrigger id="team-settings-teamsPerGroupAdvancing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].filter((num) => {
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
                  <Label htmlFor="team-settings-playoffTeams">Playoff Teams *</Label>
                  <Select
                    value={formData.playoffTeams.toString()}
                    onValueChange={(value) => {
                      const playoffTeams = parseInt(value);
                      setFormData({
                        ...formData,
                        playoffTeams,
                        playoffByes: Math.min(formData.playoffByes, playoffTeams - 2),
                      });
                    }}
                  >
                    <SelectTrigger id="team-settings-playoffTeams">
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

              <div className="space-y-2 pl-4 border-l-2">
                <Label htmlFor="team-settings-playoffByes">Top Teams with Bye</Label>
                <Select
                  value={formData.playoffByes.toString()}
                  onValueChange={(value) => setFormData({ ...formData, playoffByes: parseInt(value) })}
                >
                  <SelectTrigger id="team-settings-playoffByes" className={!gsPlayoffValid ? 'border-red-500 ring-red-500' : ''}>
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
                {!gsPlayoffValid && (
                  <p className="text-sm text-red-500 font-medium border-b-2 border-red-500 pb-1">
                    {formData.playoffTeams} playoff teams with {formData.playoffByes} bye{formData.playoffByes !== 1 ? 's' : ''} cannot produce a valid bracket. Adjust playoff teams or bye count.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pl-4 border-l-2">
                <div className="space-y-0.5">
                  <Label htmlFor="team-settings-playoffReseeding">Reseed Between Rounds</Label>
                  <p className="text-sm text-muted-foreground">
                    Re-rank remaining teams between playoff rounds so top seeds avoid each other early
                  </p>
                </div>
                <Switch
                  id="team-settings-playoffReseeding"
                  checked={formData.playoffReseeding}
                  onCheckedChange={(checked) => setFormData({ ...formData, playoffReseeding: checked })}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="team-settings-tiebreaker">Tiebreaker: Point Differential</Label>
              <p className="text-sm text-muted-foreground">
                {formData.tiebreakerPointDifferentialFirst
                  ? 'When tied on wins, point differential is used before head-to-head.'
                  : 'When tied on wins, head-to-head is used before point differential.'}
              </p>
            </div>
            <Switch
              id="team-settings-tiebreaker"
              checked={formData.tiebreakerPointDifferentialFirst}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, tiebreakerPointDifferentialFirst: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="team-settings-isDuprRequired">DUPR Required</Label>
              <p className="text-sm text-muted-foreground">Only users with DUPR accounts can join</p>
            </div>
            <Switch
              id="team-settings-isDuprRequired"
              checked={formData.isDuprRequired}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  isDuprRequired: checked,
                  isDuprPlusRequired: checked ? formData.isDuprPlusRequired : false,
                  duprPlusRequiredSubs: checked ? formData.duprPlusRequiredSubs : [],
                })
              }
            />
          </div>

          {formData.isDuprRequired && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="team-settings-duprClub">DUPR Club <span className="text-destructive">*</span></Label>
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
                            <Button type="button" variant="outline" size="sm" onClick={fetchDuprClubs}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retry
                            </Button>
                          )}
                        </div>
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
                        duprClubName: club?.name ?? '',
                      });
                    }
                  }}
                >
                  <SelectTrigger id="team-settings-duprClub">
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
              {clubsCached && clubsLastSynced && (
                <p className="text-xs text-muted-foreground">
                  Showing cached clubs (last synced: {new Date(clubsLastSynced).toLocaleString()})
                </p>
              )}

              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="team-settings-isDuprPlusRequired">DUPR+ Required</Label>
                  <p className="text-sm text-muted-foreground">Require a specific DUPR subscription tier to join</p>
                </div>
                <Switch
                  id="team-settings-isDuprPlusRequired"
                  checked={formData.isDuprPlusRequired}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      isDuprPlusRequired: checked,
                      duprPlusRequiredSubs: checked ? formData.duprPlusRequiredSubs : [],
                    })
                  }
                />
              </div>

              {formData.isDuprPlusRequired && (
                <div className="mt-2 space-y-2">
                  <Label>Required Subscription Tier</Label>
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
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="team-settings-isPrivate">Private Tournament</Label>
              <p className="text-sm text-muted-foreground">Require approval or access code to join</p>
            </div>
            <Switch
              id="team-settings-isPrivate"
              checked={formData.isPrivate}
              onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: checked })}
            />
          </div>

          {formData.isPrivate && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="team-settings-accessCode">Access Code (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="team-settings-accessCode"
                  value={formData.accessCode}
                  onChange={(e) => setFormData({ ...formData, accessCode: e.target.value })}
                  placeholder="Enter or generate code"
                />
                <Button type="button" variant="outline" onClick={generateAccessCode}>
                  Generate
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" disabled={loading || !!poolPlayInvalid || !gsPlayoffValid} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
