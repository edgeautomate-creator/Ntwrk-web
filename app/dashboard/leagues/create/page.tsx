'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { ensureAuthReady } from '@/lib/auth-helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Check, CircleAlert as AlertCircle, Users, RefreshCw, Loader as Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateRoundRobinSchedule, calculateWeeksForRoundRobin } from '@/lib/schedule-generator';

interface LeagueFormData {
  leagueName: string;
  leagueType: 'dupr' | 'non_dupr';
  duprClubId: string;
  duprClubName: string;
  numTeams: number;
  teamNames: string[];
  playersPerTeam: number;
  regularSeasonWeeks: number;
  playoffTeams: number;
  playoffByes: number;
  allowSubstitutes: boolean;
  usePointsSystem: boolean;
  pointsForMatchupWin: number;
  pointsForTiebreakerWin: number;
  pointsForTiebreakerLoss: number;
  matchesPerMatchup: number;
  gameFormat: 'rally' | 'side_out';
  gameTo: number;
  winBy2: boolean;
  enableTiebreaker: boolean;
  tiebreakerName: string;
  tiebreakerScoringType: string;
  tiebreakerGameTo: number;
  tiebreakerWinBy2: boolean;
  enforceLineupSubmission: boolean;
  useHomeAwayLogic: boolean;
  awaySubmitsFirst: boolean;
  lockLineupsAfterSubmission: boolean;
  lineupDeadlineHours: number;
  substituteRequiresDupr: boolean;
  showDuprPenaltySuggestion: boolean;
}

export default function CreateLeaguePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [duprClubs, setDuprClubs] = useState<{ id: string; name: string }[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState('');
  const [clubsCached, setClubsCached] = useState(false);
  const [clubsLastSynced, setClubsLastSynced] = useState<string | null>(null);

  const [formData, setFormData] = useState<LeagueFormData>({
    leagueName: '',
    leagueType: 'non_dupr',
    duprClubId: '',
    duprClubName: '',
    numTeams: 8,
    teamNames: Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`),
    playersPerTeam: 2,
    regularSeasonWeeks: 8,
    playoffTeams: 4,
    playoffByes: 0,
    allowSubstitutes: false,
    usePointsSystem: false,
    pointsForMatchupWin: 3,
    pointsForTiebreakerWin: 1,
    pointsForTiebreakerLoss: 0,
    matchesPerMatchup: 3,
    gameFormat: 'rally',
    gameTo: 11,
    winBy2: true,
    enableTiebreaker: false,
    tiebreakerName: 'DreamBreaker',
    tiebreakerScoringType: 'rally',
    tiebreakerGameTo: 7,
    tiebreakerWinBy2: true,
    enforceLineupSubmission: false,
    useHomeAwayLogic: true,
    awaySubmitsFirst: true,
    lockLineupsAfterSubmission: true,
    lineupDeadlineHours: 24,
    substituteRequiresDupr: false,
    showDuprPenaltySuggestion: false,
  });

  const totalSteps = 5;

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
        return;
      }
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-user-clubs`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setClubsError(data.error || 'Failed to load DUPR clubs.');
        setDuprClubs([]);
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
    } catch {
      setClubsError('Failed to load DUPR clubs.');
      setDuprClubs([]);
    } finally {
      setClubsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (formData.leagueType === 'dupr') {
      fetchDuprClubs();
    } else {
      setDuprClubs([]);
      setClubsError('');
      setFormData((prev) => ({ ...prev, duprClubId: '', duprClubName: '' }));
    }
  }, [formData.leagueType, fetchDuprClubs]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.leagueName.trim()) {
          toast({
            title: 'Validation Error',
            description: 'Please enter a league name',
            variant: 'destructive',
          });
          return false;
        }
        if (formData.numTeams < 2) {
          toast({
            title: 'Validation Error',
            description: 'League must have at least 2 teams',
            variant: 'destructive',
          });
          return false;
        }
        if (formData.playersPerTeam < 1) {
          toast({
            title: 'Validation Error',
            description: 'Teams must have at least 1 player',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 2:
        // Validate all team names are filled
        const emptyNames = formData.teamNames.filter(name => !name.trim());
        if (emptyNames.length > 0) {
          toast({
            title: 'Validation Error',
            description: 'Please enter names for all teams',
            variant: 'destructive',
          });
          return false;
        }
        // Check for duplicate team names
        const uniqueNames = new Set(formData.teamNames.map(name => name.trim().toLowerCase()));
        if (uniqueNames.size !== formData.teamNames.length) {
          toast({
            title: 'Validation Error',
            description: 'Team names must be unique',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 3:
        if (formData.matchesPerMatchup < 1) {
          toast({
            title: 'Validation Error',
            description: 'Must have at least 1 match per matchup',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleCreate = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    try {
      const authCheck = await ensureAuthReady();

      if (!authCheck.success || !authCheck.client) {
        toast({
          title: 'Authentication Error',
          description: authCheck.error || 'Authentication check failed.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const userId = authCheck.userId!;
      const authenticatedClient = authCheck.client;

      console.log('Creating league with authenticated client for user:', userId);

      const { data: userRole, error: roleError } = await authenticatedClient
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) throw new Error(`Failed to fetch organization: ${roleError.message}`);
      if (!userRole) throw new Error('Organization not found. Please contact support.');

      const { data: league, error: leagueError } = await authenticatedClient
        .from('leagues')
        .insert({
          organization_id: userRole.organization_id,
          name: formData.leagueName,
          description: `${formData.leagueType === 'dupr' ? 'DUPR' : 'Non-DUPR'} League with ${formData.playersPerTeam} players per team`,
          is_public: true,
          created_by: userId,
        })
        .select()
        .single();

      if (leagueError) {
        console.error('League insert error:', {
          message: leagueError.message,
          details: leagueError.details,
          hint: leagueError.hint,
          code: leagueError.code
        });
        throw leagueError;
      }

      console.log('League created successfully:', league.id);

      const { data: season, error: seasonError } = await authenticatedClient
        .from('seasons')
        .insert({
          league_id: league.id,
          organization_id: userRole.organization_id,
          name: `${new Date().getFullYear()} Season`,
          type: 'league',
          format: formData.playersPerTeam === 1 ? 'singles' : 'doubles',
          max_teams: formData.numTeams,
          has_playoffs: formData.playoffTeams > 0,
          is_active: true,
          league_type: formData.leagueType,
          dupr_club_id: formData.duprClubId || null,
          dupr_club_name: formData.duprClubName || null,
          players_per_team: formData.playersPerTeam,
          regular_season_weeks: formData.regularSeasonWeeks,
          playoff_teams: formData.playoffTeams,
          playoff_byes: formData.playoffByes,
          allow_substitutes: formData.allowSubstitutes,
          use_points_system: formData.usePointsSystem,
          points_for_matchup_win: formData.pointsForMatchupWin,
          points_for_tiebreaker_win: formData.pointsForTiebreakerWin,
          points_for_tiebreaker_loss: formData.pointsForTiebreakerLoss,
          matches_per_matchup: formData.matchesPerMatchup,
          game_format: formData.gameFormat,
          game_to: formData.gameTo,
          win_by_2: formData.winBy2,
          enable_tiebreaker: formData.enableTiebreaker,
          tiebreaker_name: formData.tiebreakerName,
          tiebreaker_scoring_type: formData.tiebreakerScoringType,
          tiebreaker_game_to: formData.tiebreakerGameTo,
          tiebreaker_win_by_2: formData.tiebreakerWinBy2,
          enforce_lineup_submission: formData.enforceLineupSubmission,
          use_home_away_logic: formData.useHomeAwayLogic,
          away_submits_first: formData.awaySubmitsFirst,
          lock_lineups_after_submission: formData.lockLineupsAfterSubmission,
          lineup_deadline_hours: formData.lineupDeadlineHours,
          substitute_requires_dupr: formData.leagueType === 'dupr' || formData.substituteRequiresDupr,
          show_dupr_penalty_suggestion: formData.showDuprPenaltySuggestion,
        })
        .select()
        .single();

      if (seasonError) throw seasonError;

      const teamInserts = formData.teamNames.map((teamName) => ({
        season_id: season.id,
        organization_id: userRole.organization_id,
        name: teamName.trim(),
      }));

      const { data: createdTeams, error: teamsError } = await authenticatedClient
        .from('teams')
        .insert(teamInserts)
        .select();

      if (teamsError) throw teamsError;

      const standingsInserts = createdTeams.map(team => ({
        season_id: season.id,
        team_id: team.id,
        organization_id: userRole.organization_id,
      }));

      const { error: standingsError } = await authenticatedClient
        .from('standings')
        .insert(standingsInserts);

      if (standingsError) throw standingsError;

      // Generate round-robin schedule
      const schedule = generateRoundRobinSchedule(formData.numTeams);

      // Group matchups by week
      const weekGroups = new Map<number, typeof schedule>();
      for (const matchup of schedule) {
        if (!weekGroups.has(matchup.weekNumber)) {
          weekGroups.set(matchup.weekNumber, []);
        }
        weekGroups.get(matchup.weekNumber)!.push(matchup);
      }

      // Create league weeks and matchups
      for (const [weekNumber, matchups] of Array.from(weekGroups.entries()).sort((a, b) => a[0] - b[0])) {
        const { data: week, error: weekError } = await authenticatedClient
          .from('league_weeks')
          .insert({
            season_id: season.id,
            week_number: weekNumber,
            status: 'scheduled',
          })
          .select()
          .single();

        if (weekError) throw weekError;

        // Create team matchups for this week
        const matchupInserts = matchups.map(m => ({
          league_week_id: week.id,
          home_team_id: createdTeams[m.homeTeamIndex].id,
          away_team_id: createdTeams[m.awayTeamIndex].id,
          status: 'scheduled',
        }));

        const { error: matchupsError } = await authenticatedClient
          .from('team_matchups')
          .insert(matchupInserts);

        if (matchupsError) throw matchupsError;
      }

      toast({
        title: 'Success',
        description: 'League created with schedule successfully!',
      });

      router.push(`/dashboard/leagues/${league.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Leagues
        </Button>
        <h1 className="text-3xl font-bold">Create New League</h1>
        <p className="text-muted-foreground">Set up a competitive league with customizable rules</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  step < currentStep
                    ? 'bg-primary border-primary text-white'
                    : step === currentStep
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground'
                }`}
              >
                {step < currentStep ? <Check className="h-5 w-5" /> : step}
              </div>
              {step < totalSteps && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span className={currentStep === 1 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            Basics
          </span>
          <span className={currentStep === 2 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            Team Names
          </span>
          <span className={currentStep === 3 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            Match Format
          </span>
          <span className={currentStep === 4 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            Lineups
          </span>
          <span className={currentStep === 5 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            Substitutes
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">League Basics</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure the fundamental settings for your league
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leagueName">League Name *</Label>
                  <Input
                    id="leagueName"
                    value={formData.leagueName}
                    onChange={(e) => setFormData({ ...formData, leagueName: e.target.value })}
                    placeholder="e.g., Summer Pickleball League 2024"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leagueType">League Type *</Label>
                  <Select
                    value={formData.leagueType}
                    onValueChange={(value: 'dupr' | 'non_dupr') => setFormData({ ...formData, leagueType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dupr">DUPR League</SelectItem>
                      <SelectItem value="non_dupr">Non-DUPR League</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.leagueType === 'dupr' && (
                    <>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          DUPR leagues require all players to have a DUPR rating
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-2 mt-4">
                        <Label htmlFor="dupr-club">DUPR Club (Optional)</Label>
                        {clubsLoading ? (
                          <div className="flex items-center gap-2 p-4 border rounded-lg">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Loading your DUPR clubs...</span>
                          </div>
                        ) : clubsError ? (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="flex items-center justify-between">
                              <span>{clubsError}</span>
                              {clubsError.includes('DUPR account') ? (
                                <Link href="/dashboard/profile">
                                  <Button variant="outline" size="sm">
                                    Connect DUPR
                                  </Button>
                                </Link>
                              ) : (
                                <Button variant="outline" size="sm" onClick={fetchDuprClubs}>
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Retry
                                </Button>
                              )}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <Select
                              value={formData.duprClubId || 'none'}
                              onValueChange={(value) => {
                                const actualValue = value === 'none' ? '' : value;
                                const selectedClub = duprClubs.find(c => c.id === actualValue);
                                setFormData({
                                  ...formData,
                                  duprClubId: actualValue,
                                  duprClubName: selectedClub?.name || ''
                                });
                              }}
                            >
                              <SelectTrigger id="dupr-club">
                                <SelectValue placeholder="Select a DUPR club (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {duprClubs.map((club) => (
                                  <SelectItem key={club.id} value={club.id}>
                                    {club.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Selecting a club will post match results to that club on DUPR
                            </p>
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
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numTeams">Number of Teams *</Label>
                    <Input
                      id="numTeams"
                      type="number"
                      min="2"
                      value={formData.numTeams || ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value);
                        const numTeams = val as number;

                        // Update team names array size
                        let newTeamNames = [...formData.teamNames];
                        if (numTeams > formData.teamNames.length) {
                          // Add new default team names
                          for (let i = formData.teamNames.length; i < numTeams; i++) {
                            newTeamNames.push(`Team ${i + 1}`);
                          }
                        } else if (numTeams < formData.teamNames.length) {
                          // Trim team names array
                          newTeamNames = newTeamNames.slice(0, numTeams);
                        }

                        // Calculate suggested weeks for round-robin
                        const suggestedWeeks = calculateWeeksForRoundRobin(numTeams);

                        setFormData({
                          ...formData,
                          numTeams,
                          teamNames: newTeamNames,
                          regularSeasonWeeks: suggestedWeeks,
                        });
                      }}
                      placeholder="-"
                    />
                    <p className="text-sm text-muted-foreground">
                      Suggested weeks: {calculateWeeksForRoundRobin(formData.numTeams || 0)} (each team plays once)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playersPerTeam">Players per Team *</Label>
                    <Input
                      id="playersPerTeam"
                      type="number"
                      min="1"
                      value={formData.playersPerTeam || ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value);
                        setFormData({ ...formData, playersPerTeam: val as number });
                      }}
                      placeholder="-"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regularSeasonWeeks">Regular Season Weeks *</Label>
                    <Input
                      id="regularSeasonWeeks"
                      type="number"
                      min="1"
                      value={formData.regularSeasonWeeks || ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value);
                        setFormData({ ...formData, regularSeasonWeeks: val as number });
                      }}
                      placeholder="-"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playoffTeams">Number of Playoff Teams</Label>
                    <Input
                      id="playoffTeams"
                      type="number"
                      min="0"
                      max={formData.numTeams}
                      value={formData.playoffTeams === 0 ? 0 : formData.playoffTeams || ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value);
                        const playoffTeams = val as number;
                        setFormData({
                          ...formData,
                          playoffTeams,
                          playoffByes: Math.min(formData.playoffByes, Math.max(0, playoffTeams - 2))
                        });
                      }}
                      placeholder="-"
                    />
                  </div>
                </div>

                {formData.playoffTeams > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="playoffByes">Top Teams with Bye</Label>
                    <Select
                      value={formData.playoffByes.toString()}
                      onValueChange={(value) => setFormData({ ...formData, playoffByes: parseInt(value) })}
                    >
                      <SelectTrigger id="playoffByes">
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
                        ? 'Teams 3-8 play first round, winners + Teams 1-2 advance to quarterfinals'
                        : formData.playoffByes === 4 && formData.playoffTeams === 6
                        ? 'Teams 5-6 play first round, winner + Teams 1-4 advance'
                        : formData.playoffByes === 4 && formData.playoffTeams === 8
                        ? 'Teams 5-8 play first round (2 matches), winners face Teams 1-4 in quarterfinals'
                        : `Top ${formData.playoffByes} seeds automatically advance to next round`
                      }
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Allow Substitutes</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable teams to add substitute players
                    </p>
                  </div>
                  <Switch
                    checked={formData.allowSubstitutes}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowSubstitutes: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Use Points System</Label>
                    <p className="text-sm text-muted-foreground">
                      Award points for wins instead of using win-loss records
                    </p>
                  </div>
                  <Switch
                    checked={formData.usePointsSystem}
                    onCheckedChange={(checked) => setFormData({ ...formData, usePointsSystem: checked })}
                  />
                </div>

                {formData.usePointsSystem && (
                  <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="pointsForMatchupWin">Points for Matchup Win</Label>
                      <Input
                        id="pointsForMatchupWin"
                        type="number"
                        min="0"
                        value={formData.pointsForMatchupWin === 0 ? 0 : formData.pointsForMatchupWin || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                          setFormData({ ...formData, pointsForMatchupWin: val as number });
                        }}
                        placeholder="-"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pointsForTiebreakerWin">Points for Tiebreaker Win</Label>
                      <Input
                        id="pointsForTiebreakerWin"
                        type="number"
                        min="0"
                        value={formData.pointsForTiebreakerWin === 0 ? 0 : formData.pointsForTiebreakerWin || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                          setFormData({ ...formData, pointsForTiebreakerWin: val as number });
                        }}
                        placeholder="-"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pointsForTiebreakerLoss">Points for Tiebreaker Loss</Label>
                      <Input
                        id="pointsForTiebreakerLoss"
                        type="number"
                        min="0"
                        value={formData.pointsForTiebreakerLoss === 0 ? 0 : formData.pointsForTiebreakerLoss || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                          setFormData({ ...formData, pointsForTiebreakerLoss: val as number });
                        }}
                        placeholder="-"
                      />
                    </div>
                  </div>
                )}

                {!formData.usePointsSystem && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Standings will be sorted by:</strong>
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Team Matchup Wins</li>
                        <li>Individual Match Wins</li>
                        <li>Point Differential</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Team Names</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Enter the names for all {formData.numTeams} teams in your league
                </p>
              </div>

              <div className="space-y-4">
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    Team names will be used throughout the league schedule. Make them unique and memorable!
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.teamNames.map((teamName, index) => (
                    <div key={index} className="space-y-2">
                      <Label htmlFor={`team-${index}`}>
                        Team {index + 1} *
                      </Label>
                      <Input
                        id={`team-${index}`}
                        value={teamName}
                        onChange={(e) => {
                          const newTeamNames = [...formData.teamNames];
                          newTeamNames[index] = e.target.value;
                          setFormData({ ...formData, teamNames: newTeamNames });
                        }}
                        placeholder={`Enter team ${index + 1} name`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Match Format</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Define how matches are played and scored
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="matchesPerMatchup">Matches per Team Matchup *</Label>
                  <Input
                    id="matchesPerMatchup"
                    type="number"
                    min="1"
                    value={formData.matchesPerMatchup || ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value);
                      setFormData({ ...formData, matchesPerMatchup: val as number });
                    }}
                    placeholder="-"
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of individual matches when two teams face each other
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gameFormat">Game Format</Label>
                    <Select
                      value={formData.gameFormat}
                      onValueChange={(value: 'rally' | 'side_out') => setFormData({ ...formData, gameFormat: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rally">Rally Scoring</SelectItem>
                        <SelectItem value="side_out">Side-out Scoring</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gameTo">Game To</Label>
                    <Select
                      value={formData.gameTo.toString()}
                      onValueChange={(value) => setFormData({ ...formData, gameTo: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="11">11 Points</SelectItem>
                        <SelectItem value="15">15 Points</SelectItem>
                        <SelectItem value="21">21 Points</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Win by 2</Label>
                    <p className="text-sm text-muted-foreground">
                      Require winning team to win by 2 points
                    </p>
                  </div>
                  <Switch
                    checked={formData.winBy2}
                    onCheckedChange={(checked) => setFormData({ ...formData, winBy2: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Enable Tiebreaker</Label>
                    <p className="text-sm text-muted-foreground">
                      Play a tiebreaker match if teams are tied
                    </p>
                  </div>
                  <Switch
                    checked={formData.enableTiebreaker}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableTiebreaker: checked })}
                  />
                </div>

                {formData.enableTiebreaker && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="tiebreakerName">Tiebreaker Name</Label>
                      <Input
                        id="tiebreakerName"
                        value={formData.tiebreakerName}
                        onChange={(e) => setFormData({ ...formData, tiebreakerName: e.target.value })}
                        placeholder="e.g., DreamBreaker"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tiebreakerScoringType">Tiebreaker Scoring</Label>
                        <Select
                          value={formData.tiebreakerScoringType}
                          onValueChange={(value) => setFormData({ ...formData, tiebreakerScoringType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rally">Rally</SelectItem>
                            <SelectItem value="side_out">Side-out</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tiebreakerGameTo">Tiebreaker Game To</Label>
                        <Input
                          id="tiebreakerGameTo"
                          type="number"
                          min="1"
                          value={formData.tiebreakerGameTo || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value);
                            setFormData({ ...formData, tiebreakerGameTo: val as number });
                          }}
                          placeholder="-"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <Label>Tiebreaker Win by 2</Label>
                      <Switch
                        checked={formData.tiebreakerWinBy2}
                        onCheckedChange={(checked) => setFormData({ ...formData, tiebreakerWinBy2: checked })}
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Lineup Enforcement</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure how teams submit and manage lineups
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Enforce Lineup Submission</Label>
                    <p className="text-sm text-muted-foreground">
                      Require teams to submit lineups before matches
                    </p>
                  </div>
                  <Switch
                    checked={formData.enforceLineupSubmission}
                    onCheckedChange={(checked) => setFormData({ ...formData, enforceLineupSubmission: checked })}
                  />
                </div>

                {formData.enforceLineupSubmission && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Use Home/Away Logic</Label>
                        <p className="text-sm text-muted-foreground">
                          Designate one team as home and one as away
                        </p>
                      </div>
                      <Switch
                        checked={formData.useHomeAwayLogic}
                        onCheckedChange={(checked) => setFormData({ ...formData, useHomeAwayLogic: checked })}
                      />
                    </div>

                    {formData.useHomeAwayLogic && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label>Away Team Submits First</Label>
                          <p className="text-sm text-muted-foreground">
                            Away team must submit lineup before home team
                          </p>
                        </div>
                        <Switch
                          checked={formData.awaySubmitsFirst}
                          onCheckedChange={(checked) => setFormData({ ...formData, awaySubmitsFirst: checked })}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Lock Lineups After Submission</Label>
                        <p className="text-sm text-muted-foreground">
                          Prevent changes once lineup is submitted
                        </p>
                      </div>
                      <Switch
                        checked={formData.lockLineupsAfterSubmission}
                        onCheckedChange={(checked) => setFormData({ ...formData, lockLineupsAfterSubmission: checked })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lineupDeadlineHours">Lineup Deadline (hours before match)</Label>
                      <Input
                        id="lineupDeadlineHours"
                        type="number"
                        min="0"
                        value={formData.lineupDeadlineHours === 0 ? 0 : formData.lineupDeadlineHours || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                          setFormData({ ...formData, lineupDeadlineHours: val as number });
                        }}
                        placeholder="-"
                      />
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Only team captains can submit or edit lineups
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Substitute Rules</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure rules for substitute players
                </p>
              </div>

              <div className="space-y-4">
                {!formData.allowSubstitutes ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Substitutes are disabled for this league. You can enable them in Step 1.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Require DUPR Score</Label>
                        <p className="text-sm text-muted-foreground">
                          Substitutes must have a DUPR rating
                        </p>
                      </div>
                      <Switch
                        checked={formData.leagueType === 'dupr' || formData.substituteRequiresDupr}
                        onCheckedChange={(checked) => setFormData({ ...formData, substituteRequiresDupr: checked })}
                        disabled={formData.leagueType === 'dupr'}
                      />
                    </div>

                    {formData.leagueType === 'dupr' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          DUPR rating is automatically required for DUPR leagues
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Display DUPR Penalty Suggestion</Label>
                        <p className="text-sm text-muted-foreground">
                          Show suggested penalty points based on DUPR difference
                        </p>
                      </div>
                      <Switch
                        checked={formData.showDuprPenaltySuggestion}
                        onCheckedChange={(checked) => setFormData({ ...formData, showDuprPenaltySuggestion: checked })}
                      />
                    </div>

                    {formData.showDuprPenaltySuggestion && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Important:</strong> Penalty suggestions are not automatically enforced.
                          Team captains must manually confirm and apply penalties.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                <div className="mt-8 p-6 border rounded-lg bg-muted/30">
                  <h3 className="font-semibold mb-4">League Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">League Name:</span>
                      <span className="font-medium">{formData.leagueName || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium">{formData.leagueType === 'dupr' ? 'DUPR League' : 'Non-DUPR League'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Teams:</span>
                      <span className="font-medium">{formData.numTeams}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Players per Team:</span>
                      <span className="font-medium">{formData.playersPerTeam}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Regular Season Weeks:</span>
                      <span className="font-medium">{formData.regularSeasonWeeks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Playoff Teams:</span>
                      <span className="font-medium">{formData.playoffTeams}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Scoring System:</span>
                      <span className="font-medium">{formData.usePointsSystem ? 'Points-based' : 'Win-Loss'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Game Format:</span>
                      <span className="font-medium">{formData.gameFormat === 'rally' ? 'Rally' : 'Side-out'} to {formData.gameTo}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < totalSteps ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create League'}
          </Button>
        )}
      </div>
    </div>
  );
}
