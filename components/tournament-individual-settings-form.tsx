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
import type { Tournament } from '@/app/dashboard/tournaments/[id]/page';

interface TournamentIndividualSettingsFormProps {
  tournament: Tournament;
  currentPlayerCount: number;
  onSaved?: () => Promise<void>;
}

export function TournamentIndividualSettingsForm({
  tournament,
  currentPlayerCount,
  onSaved,
}: TournamentIndividualSettingsFormProps) {
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
    playerCapacity: tournament.player_capacity ?? 8,
    bestOf: (tournament.best_of ?? 1) as 1 | 3 | 5,
    hasPlayoffs: tournament.has_playoffs ?? false,
    playoffQualifiers: tournament.playoff_qualifiers ?? 4,
    playoffByes: tournament.playoff_byes ?? 0,
    playoffReseeding: tournament.playoff_reseeding ?? false,
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
    setFormData({
      name: tournament.name,
      date: tournament.date ?? '',
      startTime: tournament.start_time ?? '',
      location: tournament.location ?? '',
      teamFormat: (tournament.team_format ?? 'doubles') as 'singles' | 'doubles',
      playerCapacity: tournament.player_capacity ?? 8,
      bestOf: (tournament.best_of ?? 1) as 1 | 3 | 5,
      hasPlayoffs: tournament.has_playoffs ?? false,
      playoffQualifiers: tournament.playoff_qualifiers ?? 4,
      playoffByes: tournament.playoff_byes ?? 0,
      playoffReseeding: tournament.playoff_reseeding ?? false,
      tiebreakerPointDifferentialFirst: tournament.tiebreaker_point_differential_first ?? false,
      isDuprRequired: tournament.is_dupr_required ?? false,
      duprClubId: tournament.dupr_club_id ?? '',
      duprClubName: tournament.dupr_club_name ?? '',
      isDuprPlusRequired: nonBasicSubs.length > 0,
      duprPlusRequiredSubs: nonBasicSubs,
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
    tournament.player_capacity,
    tournament.best_of,
    tournament.has_playoffs,
    tournament.playoff_qualifiers,
    tournament.playoff_byes,
    tournament.playoff_reseeding,
    tournament.tiebreaker_point_differential_first,
    tournament.is_dupr_required,
    tournament.dupr_club_id,
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

  const generateAccessCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({ ...formData, accessCode: code });
  };

  const playoffValid = !formData.hasPlayoffs || validatePlayoffStructure(formData.playoffQualifiers, formData.playoffByes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Game name is required.');
      return;
    }

    if (formData.playerCapacity < currentPlayerCount) {
      setError(`Player capacity cannot be less than the ${currentPlayerCount} players already registered.`);
      return;
    }

    if (formData.isDuprRequired && !formData.duprClubId) {
      setError('A DUPR club must be selected for DUPR-required tournaments.');
      return;
    }

    if (formData.hasPlayoffs && !playoffValid) {
      setError(`${formData.playoffQualifiers} playoff qualifiers with ${formData.playoffByes} bye${formData.playoffByes !== 1 ? 's' : ''} cannot produce a valid bracket.`);
      return;
    }

    if (formData.isDuprPlusRequired && formData.duprPlusRequiredSubs.length === 0) {
      setError('Select at least one DUPR+ subscription tier, or disable DUPR+ Required.');
      return;
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
          player_capacity: formData.playerCapacity,
          best_of: formData.bestOf,
          has_playoffs: formData.hasPlayoffs,
          playoff_qualifiers: formData.hasPlayoffs ? formData.playoffQualifiers : null,
          playoff_byes: formData.hasPlayoffs ? formData.playoffByes : null,
          playoff_reseeding: formData.hasPlayoffs ? formData.playoffReseeding : false,
          tiebreaker_point_differential_first: formData.tiebreakerPointDifferentialFirst,
          is_dupr_required: formData.isDuprRequired,
          dupr_club_id: formData.duprClubId || null,
          dupr_club_name: formData.duprClubName || null,
          dupr_plus_required_subs:
            formData.isDuprPlusRequired && formData.duprPlusRequiredSubs.length > 0
              ? formData.duprPlusRequiredSubs.includes('BASIC_L1')
                ? formData.duprPlusRequiredSubs
                : ['BASIC_L1', ...formData.duprPlusRequiredSubs]
              : [],
          is_private: formData.isPrivate,
          access_code: formData.isPrivate ? formData.accessCode || null : null,
        })
        .eq('id', tournament.id);

      if (updateError) throw updateError;

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
          Edit tournament details. After matchups exist, use Rebuild Schedule on the Players tab so remaining games match the roster.
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
            <Label htmlFor="settings-name">Game Name *</Label>
            <Input
              id="settings-name"
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
            <Label htmlFor="settings-location">Location</Label>
            <Input
              id="settings-location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Community Sports Center"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-teamFormat">Game Type *</Label>
            <Select
              value={formData.teamFormat}
              onValueChange={(value: 'singles' | 'doubles') =>
                setFormData({ ...formData, teamFormat: value })
              }
            >
              <SelectTrigger id="settings-teamFormat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Singles</SelectItem>
                <SelectItem value="doubles">Doubles</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-playerCapacity">Number of Players *</Label>
            <Select
              value={formData.playerCapacity.toString()}
              onValueChange={(value) => setFormData({ ...formData, playerCapacity: parseInt(value) })}
            >
              <SelectTrigger id="settings-playerCapacity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 19 }, (_, i) => i + 2).map((num) => (
                  <SelectItem key={num} value={num.toString()} disabled={num < currentPlayerCount}>
                    {num} Players{num < currentPlayerCount ? ' (too few)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentPlayerCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {currentPlayerCount} player{currentPlayerCount !== 1 ? 's' : ''} already registered
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-bestOf">Best of *</Label>
            <Select
              value={formData.bestOf.toString()}
              onValueChange={(value) => setFormData({ ...formData, bestOf: parseInt(value) as 1 | 3 | 5 })}
            >
              <SelectTrigger id="settings-bestOf">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Best of 1</SelectItem>
                <SelectItem value="3">Best of 3</SelectItem>
                <SelectItem value="5">Best of 5</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">Number of games per match</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="settings-hasPlayoffs">Include Playoffs</Label>
              <p className="text-sm text-muted-foreground">
                Top players advance to single-elimination playoff bracket
              </p>
            </div>
            <Switch
              id="settings-hasPlayoffs"
              checked={formData.hasPlayoffs}
              onCheckedChange={(checked) => setFormData({ ...formData, hasPlayoffs: checked })}
            />
          </div>

          {formData.hasPlayoffs && (
            <>
              <div className="space-y-2 pl-4 border-l-2">
                <Label htmlFor="settings-playoffQualifiers">Playoff Qualifiers</Label>
                <Select
                  value={formData.playoffQualifiers.toString()}
                  onValueChange={(value) => setFormData({ ...formData, playoffQualifiers: parseInt(value) })}
                >
                  <SelectTrigger id="settings-playoffQualifiers">
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
              </div>

              <div className="space-y-2 pl-4 border-l-2">
                <Label htmlFor="settings-playoffByes">Top Seeds with Bye</Label>
                <Select
                  value={formData.playoffByes.toString()}
                  onValueChange={(value) => setFormData({ ...formData, playoffByes: parseInt(value) })}
                >
                  <SelectTrigger id="settings-playoffByes" className={!playoffValid ? 'border-red-500' : ''}>
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
                {!playoffValid && (
                  <p className="text-sm text-red-500 font-medium">
                    Invalid playoff bracket configuration. Adjust qualifiers or byes.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pl-4 border-l-2">
                <div className="space-y-0.5">
                  <Label htmlFor="settings-playoffReseeding">Reseed Between Rounds</Label>
                  <p className="text-sm text-muted-foreground">
                    Re-rank remaining players between playoff rounds
                  </p>
                </div>
                <Switch
                  id="settings-playoffReseeding"
                  checked={formData.playoffReseeding}
                  onCheckedChange={(checked) => setFormData({ ...formData, playoffReseeding: checked })}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="settings-tiebreaker">Tiebreaker: Point Differential</Label>
              <p className="text-sm text-muted-foreground">
                {formData.tiebreakerPointDifferentialFirst
                  ? 'When tied on wins, point differential is used before head-to-head.'
                  : 'When tied on wins, head-to-head is used before point differential.'}
              </p>
            </div>
            <Switch
              id="settings-tiebreaker"
              checked={formData.tiebreakerPointDifferentialFirst}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, tiebreakerPointDifferentialFirst: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="settings-isDuprRequired">DUPR Required</Label>
              <p className="text-sm text-muted-foreground">Only users with DUPR accounts can join</p>
            </div>
            <Switch
              id="settings-isDuprRequired"
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
              <Label htmlFor="settings-duprClub">DUPR Club <span className="text-destructive">*</span></Label>
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
                  <SelectTrigger id="settings-duprClub">
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
                  <Label htmlFor="settings-isDuprPlusRequired">DUPR+ Required</Label>
                  <p className="text-sm text-muted-foreground">Require a specific DUPR subscription tier to join</p>
                </div>
                <Switch
                  id="settings-isDuprPlusRequired"
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
              <Label htmlFor="settings-isPrivate">Private Tournament</Label>
              <p className="text-sm text-muted-foreground">Require approval or access code to join</p>
            </div>
            <Switch
              id="settings-isPrivate"
              checked={formData.isPrivate}
              onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: checked })}
            />
          </div>

          {formData.isPrivate && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="settings-accessCode">Access Code (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="settings-accessCode"
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

          <Button type="submit" disabled={loading || !playoffValid} className="w-full">
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
