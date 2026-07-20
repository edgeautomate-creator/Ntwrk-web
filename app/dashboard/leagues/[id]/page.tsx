'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Trophy, CircleAlert as AlertCircle, Plus, CreditCard as Edit, Trash2, Share2, Copy, Check, MapPin } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getDisplayName } from '@/lib/utils';

interface Season {
  id: string;
  league_id: string;
  name: string;
  type: string;
  format: string;
  league_type: string;
  players_per_team: number;
  regular_season_weeks: number;
  playoff_teams: number;
  allow_substitutes: boolean;
  use_points_system: boolean;
  points_for_matchup_win: number;
  matches_per_matchup: number;
  game_format: string;
  game_to: number;
  win_by_2: boolean;
  enable_tiebreaker: boolean;
  tiebreaker_name: string;
  playoffs_started: boolean;
  champion_team_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface League {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  is_public: boolean;
  created_at: string;
  created_by?: string | null;
}

interface TeamPlayer {
  id: string
  team_id: string
  user_id: string
  is_substitute: boolean
  profiles?: {
    full_name: string
    email: string
  }
}


interface Team {
  id: string;
  season_id: string;
  name: string;
  description: string;
  captain_user_id: string | null;
  created_at: string;
  player_count?: number;
  team_players?: TeamPlayer[]
}

interface LeagueWeek {
  id: string;
  season_id: string;
  week_number: number;
  status: string;
  created_at: string;
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

interface Standing {
  id: string;
  season_id: string;
  team_id: string;
  matchup_wins: number;
  matchup_losses: number;
  match_wins: number;
  match_losses: number;
  league_points: number;
  point_differential: number;
  tiebreaker_wins: number;
  tiebreaker_losses: number;
  team?: Team;
}

export default function LeagueDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [weeks, setWeeks] = useState<LeagueWeek[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teams');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateWeekDialog, setShowCreateWeekDialog] = useState(false);
  const [newWeekNumber, setNewWeekNumber] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [weekMatchups, setWeekMatchups] = useState<TeamMatchup[]>([]);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [userIsSubstitute, setUserIsSubstitute] = useState(false);
  const [selectedTeamForSub, setSelectedTeamForSub] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingLeague, setDeletingLeague] = useState(false);
  const [standingsCopied, setStandingsCopied] = useState(false);

  useEffect(() => {
    loadLeagueData();
  }, [params.id]);

  useEffect(() => {
    if (season && currentUserId) {
      loadSubstitutes();
    }
  }, [season, currentUserId]);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekMatchups(selectedWeek);
    }
  }, [selectedWeek]);

  const loadLeagueData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setCurrentUserId(session.user.id);

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', params.id)
        .single();

      if (leagueError) throw leagueError;
      setLeague(leagueData);

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('organization_id', leagueData.organization_id)
        .maybeSingle();

      setIsAdmin(userRole?.role === 'admin' || userRole?.role === 'organizer');

      const { data: seasonData } = await supabase
        .from('seasons')
        .select('*')
        .eq('league_id', params.id)
        .eq('is_active', true)
        .maybeSingle();

      if (seasonData) {
        setSeason(seasonData);
        await loadTeams(seasonData.id);
        await loadWeeks(seasonData.id);
        await loadStandings(seasonData.id);
      }
    } catch (error) {
      console.error('Error loading league:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async (seasonId: string) => {
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select(`
        *,
        team_players (profiles (full_name,email))
        `)
      .eq('season_id', seasonId)
      .order('name', { ascending: true });

    if (teamsError || !teamsData) {
      console.error(teamsError);
      return;
    }
    const allPlayerIds = new Set<string | number>();
    teamsData.forEach(team => {
      if (team.player1_id) allPlayerIds.add(team.player1_id);
      if (team.player2_id) allPlayerIds.add(team.player2_id);
      if (team.player3_id) allPlayerIds.add(team.player3_id);
      if (team.player4_id) allPlayerIds.add(team.player4_id);
    });

    let profilesMap: Record<string, any> = {};

    if (allPlayerIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, email')
        .in('id', Array.from(allPlayerIds));

      profiles?.forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    const teamsWithPlayers = teamsData.map(team => {
      const playerList = [
        team.player1_id ? profilesMap[team.player1_id] : null,
        team.player2_id ? profilesMap[team.player2_id] : null,
        team.player3_id ? profilesMap[team.player3_id] : null,
        team.player4_id ? profilesMap[team.player4_id] : null,
      ].filter(Boolean);

      return {
        ...team,
        players: playerList,
        player_count: playerList.length,
      };
    });

    setTeams(teamsWithPlayers);
  };

  const loadWeeks = async (seasonId: string) => {
    const { data } = await supabase
      .from('league_weeks')
      .select('*')
      .eq('season_id', seasonId)
      .order('week_number', { ascending: true });

    if (data) {
      setWeeks(data);
      if (data.length > 0 && !selectedWeek) {
        setSelectedWeek(data[0].id);
      }
    }
  };

  const loadWeekMatchups = async (weekId: string) => {
    const { data } = await supabase
      .from('team_matchups')
      .select(`
        *,
        home_team:teams!team_matchups_home_team_id_fkey(*),
        away_team:teams!team_matchups_away_team_id_fkey(*)
      `)
      .eq('league_week_id', weekId)
      .order('scheduled_time', { ascending: true });

    if (data) {
      setWeekMatchups(data as any);
    }
  };

  const loadStandings = async (seasonId: string) => {
    const { data } = await supabase
      .from('standings')
      .select('*, team:teams!standings_team_id_fkey(*)')
      .eq('season_id', seasonId);

    if (data) {
      const sortedStandings = data.sort((a, b) => {
        if (season?.use_points_system) {
          if (b.league_points !== a.league_points) return b.league_points - a.league_points;
        } else {
          if (b.matchup_wins !== a.matchup_wins) return b.matchup_wins - a.matchup_wins;
          if (b.match_wins !== a.match_wins) return b.match_wins - a.match_wins;
        }
        return b.point_differential - a.point_differential;
      });
      setStandings(sortedStandings as any);
    }
  };

  const loadSubstitutes = async () => {
    if (!season || !currentUserId) return;

    // Load all substitutes for this season
    const { data: subsData } = await supabase
      .from('team_players')
      .select(`
        *,
        team:teams(id, name),
        profile:profiles(id, full_name, dupr_singles_rating, dupr_doubles_rating)
      `)
      .eq('is_substitute', true)
      .in('team_id', teams.map(t => t.id));

    if (subsData) {
      setSubstitutes(subsData);
      const isUserSub = subsData.some(sub => sub.user_id === currentUserId);
      setUserIsSubstitute(isUserSub);
    }
  };

  const claimSubstituteSpot = async () => {
    if (!selectedTeamForSub || !season || !league) {
      toast({
        title: 'Error',
        description: 'Please select a team',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('team_players')
        .insert({
          team_id: selectedTeamForSub,
          user_id: currentUserId,
          organization_id: league.organization_id,
          is_substitute: true,
          is_captain: false,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'You have been added as a substitute!',
      });

      setUserIsSubstitute(true);
      setSelectedTeamForSub('');
      await loadSubstitutes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const createWeek = async () => {
    if (!season) return;

    try {
      const { error } = await supabase
        .from('league_weeks')
        .insert({
          season_id: season.id,
          week_number: newWeekNumber,
          status: 'scheduled',
        });

      if (error) throw error;

      setShowCreateWeekDialog(false);
      setNewWeekNumber(newWeekNumber + 1);
      await loadWeeks(season.id);
    } catch (error: any) {
      alert(`Error creating week: ${error.message}`);
    }
  };

  const createTeam = async () => {
    if (!season || !league) return;

    if (!newTeamName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a team name',
        variant: 'destructive',
      });
      return;
    }

    try {
      const nextTeamNumber = teams.length + 1;
      const teamName = newTeamName.trim();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          season_id: season.id,
          organization_id: league.organization_id,
          name: teamName,
          captain_user_id: session.user.id,
          player1_id: session.user.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      const { error: standingsError } = await supabase
        .from('standings')
        .insert({
          season_id: season.id,
          team_id: team.id,
          organization_id: league.organization_id,
          matchup_wins: 0,
          matchup_losses: 0,
          match_wins: 0,
          match_losses: 0,
          league_points: 0,
          point_differential: 0,
          tiebreaker_wins: 0,
          tiebreaker_losses: 0,
        });

      if (standingsError) throw standingsError;

      toast({
        title: 'Success',
        description: `Team "${teamName}" created successfully!`,
      });

      setShowCreateTeamDialog(false);
      setNewTeamName('');
      setNewTeamDescription('');
      await loadTeams(season.id);
      await loadStandings(season.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = async () => {
    const leagueUrl = `${window.location.origin}/dashboard/leagues/${league?.id}`;
    try {
      await navigator.clipboard.writeText(leagueUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({
        title: 'Link copied!',
        description: 'League link copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLeague = async () => {
    if (!league) return;
    setDeletingLeague(true);
    try {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', league.id);

      if (error) {
        console.error('Error deleting league:', error);
        toast({
          title: 'Unable to delete league',
          description: 'This league has recorded scores or you do not have permission to delete it.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'League deleted',
          description: 'The league has been removed.',
        });
        router.push('/dashboard/leagues');
      }
    } finally {
      setDeletingLeague(false);
      setShowDeleteDialog(false);
    }
  };

  const handleShareLeagueStandings = async () => {
    if (!league || !season || standings.length === 0) return;

    // Calculate total matchups completed
    const totalMatchups = standings.reduce((sum, s) => sum + s.matchup_wins + s.matchup_losses, 0) / 2;

    // Format date - use created_at if no other date is available
    const dateStr = season.created_at ? new Date(season.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : '';

    // Build header
    let text = `${league.name} ${dateStr}\n\n`;
    text += `Standings (${totalMatchups})\n`;

    // Add standings rows
    standings.forEach((standing) => {
      const teamName = standing.team?.name || 'Unknown Team';
      const w = standing.matchup_wins;
      const l = standing.matchup_losses;
      const diff = standing.point_differential;
      const diffStr = diff >= 0 ? `+${diff}` : diff.toString();

      text += `${teamName}   ${w} ${l} ${diffStr}\n`;
    });

    try {
      await navigator.clipboard.writeText(text.trim());
      setStandingsCopied(true);
      setTimeout(() => setStandingsCopied(false), 2000);
      toast({
        title: 'Standings copied',
        description: 'Ready to paste in messages',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive',
      });
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

  if (!league || !season) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>League not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const completedWeeks = weeks.filter(w => w.status === 'completed').length;
  const playoffCutoff = season.playoff_teams;

  return (
    <div className="container py-8">
      <div className="mb-8 mx-5">
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {league.name}
                </h1>
                {season.playoffs_started && (
                  <Badge className="bg-gradient-to-r from-primary to-secondary px-3 py-1 text-sm">
                    Playoffs
              </Badge>
            )}
            </div>
            {league.created_by === currentUserId && (
              <Button
                variant="outline"
                size="icon"
                className="text-red-500 border-red-400/70 hover:bg-red-500/10 hover:text-red-600 shrink-0"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

            {/* Quick meta badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="secondary" className="text-xs">
                {season.league_type === 'dupr' ? 'DUPR League' : 'Non-DUPR League'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {season.players_per_team} players / team
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {season.regular_season_weeks} week season
              </Badge>
              {season.format && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {season.format}
                </Badge>
              )}
            </div>
          </div>

          {/* Body / details */}
          <div className="px-5 py-4 space-y-3">
            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="default" className="min-w-[140px]">
                View Matches
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareDialog(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share League
              </Button>
            </div>
          </div>
        </div>

      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className='mx-5' >
        <TabsList className={`grid w-full ${season.playoffs_started ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="teams">Teams List</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          {season.playoffs_started && (
            <TabsTrigger value="playoffs">
              <Trophy className="h-4 w-4 mr-1" />
              Playoffs
            </TabsTrigger>
          )}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>League Settings</CardTitle>
                <CardDescription>Current configuration for this league</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Matches per Matchup:</span>
                    <span className="ml-2 font-medium">{season.matches_per_matchup}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Game Format:</span>
                    <span className="ml-2 font-medium capitalize">{season.game_format}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scoring:</span>
                    <span className="ml-2 font-medium">
                      {season.game_to} points{season.win_by_2 ? ', win by 2' : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tiebreaker:</span>
                    <span className="ml-2 font-medium">
                      {season.enable_tiebreaker ? season.tiebreaker_name : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Substitutes:</span>
                    <span className="ml-2 font-medium">
                      {season.allow_substitutes ? 'Allowed' : 'Not allowed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Points System:</span>
                    <span className="ml-2 font-medium">
                      {season.use_points_system ? `${season.points_for_matchup_win} pts per win` : 'Win-Loss'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {standings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Playoff Tracker</CardTitle>
                  <CardDescription>Top {playoffCutoff} teams advance to playoffs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {standings.slice(0, Math.min(playoffCutoff + 2, standings.length)).map((standing, index) => (
                      <div
                        key={standing.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${index < playoffCutoff
                            ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="font-bold w-6">#{index + 1}</div>
                          <div>
                            <div className="font-medium">{standing.team?.name}</div>
                            {index < playoffCutoff && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Playoff Position
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          {season.use_points_system ? (
                            <div className="font-semibold">{standing.league_points} pts</div>
                          ) : (
                            <div className="font-semibold">
                              {standing.matchup_wins}-{standing.matchup_losses}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {playoffCutoff < standings.length && (
                      <div className="border-t-2 border-dashed border-muted-foreground my-2" />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Substitutes</CardTitle>
                <CardDescription>Players available as substitutes for any team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!userIsSubstitute && (
                    <div className="space-y-3">
                      <Label>Claim a Substitute Spot</Label>
                      <div className="flex gap-2">
                        <Select value={selectedTeamForSub} onValueChange={setSelectedTeamForSub}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={claimSubstituteSpot}>
                          <Plus className="h-4 w-4 mr-2" />
                          Claim Spot
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Claim a substitute spot to be available for team captains to add to their weekly roster
                      </p>
                    </div>
                  )}

                  {userIsSubstitute && (
                    <Alert>
                      <Check className="h-4 w-4" />
                      <AlertDescription>
                        You are registered as a substitute. Team captains can add you to their weekly roster.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Available Substitutes ({substitutes.length})</h4>
                    {substitutes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No substitutes available yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {substitutes.map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{sub.profile?.full_name || 'Unknown Player'}</div>
                              <div className="text-sm text-muted-foreground">
                                Team: {sub.team?.name}
                              </div>
                            </div>
                            {season.league_type === 'dupr' && (
                              <div className="text-right text-sm">
                                <div className="text-muted-foreground">DUPR</div>
                                <div className="font-medium">
                                  {sub.profile?.dupr_singles_rating || sub.profile?.dupr_doubles_rating || 'N/A'}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>League Teams</CardTitle>
                  <CardDescription>{teams.length} teams registered</CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={() => setShowCreateTeamDialog(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Team
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by adding your first team to the league
                  </p>
                  {isAdmin && (
                    <Button onClick={() => setShowCreateTeamDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Team
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">  {/* slightly bigger gap between team cards */}
                  {teams.map((team, index) => {
                    const teamStanding = standings.find(s => s.team_id === team.id);
                    // Assuming team.players is an array of player objects with at least { id, name, ... }
                    // Adjust field names if your actual data uses different keys (e.g. full_name, username)
                    return (
                      <Card
                      key={team.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors overflow-hidden"
                      onClick={() => router.push(`/dashboard/leagues/${params.id}/team/${team.id}`)}
                    >
                      <CardContent className="p-5 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-stretch gap-0 rounded-lg overflow-hidden border border-border/60 shadow-sm">
                    
                          {/* Team name – full width on mobile, left side on wider screens */}
                          <div className="
                            bg-muted/70 px-4 py-3.5 sm:py-4 
                            border-b sm:border-b-0 sm:border-r border-border 
                            flex items-center justify-center sm:justify-start
                            min-w-[140px] sm:min-w-[140px] max-w-none sm:max-w-[180px]
                            text-center sm:text-left
                          ">
                            <div className="text-sm font-semibold uppercase tracking-wide text-foreground/90 truncate w-full">
                              {team.name}
                            </div>
                          </div>
                    
                          {/* Players area */}
                          <div className="
                            flex-1 px-4 py-3 
                            flex flex-wrap items-center gap-x-4 gap-y-2.5
                            bg-background/40
                          ">
                            {Array.isArray(team.team_players) && team.team_players?.length > 0 ? (
                              team.team_players.map((player: any) => (
                                <div
                                  key={player.id}
                                  className="flex items-center gap-2 shrink-0"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary/70 flex-shrink-0" />
                                  <span className="text-sm font-medium truncate max-w-[140px] sm:max-w-[160px]">
                                    {getDisplayName({
                                      display_name: player?.profiles?.display_name,
                                      full_name: player?.profiles?.full_name,
                                      email: player?.profiles?.email
                                    }, 'Unknown Player')}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                No players yet
                              </span>
                            )}
                          </div>
                    
                        </div>
                    
                        {/* You can keep other content below if you have more */}
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Match Schedule</CardTitle>
                  <CardDescription>Weekly matchups and results</CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={() => setShowCreateWeekDialog(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Week
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {weeks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No weeks created yet. Create your first week to start scheduling matches.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label>Select Week:</Label>
                    <Select value={selectedWeek || ''} onValueChange={setSelectedWeek}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weeks.map((week) => (
                          <SelectItem key={week.id} value={week.id}>
                            Week {week.week_number}
                            {week.status === 'completed' && ' ✓'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {weekMatchups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      No matchups scheduled for this week yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {weekMatchups.map((matchup) => (
                        <Card
                          key={matchup.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => router.push(`/dashboard/leagues/${params.id}/matchup/${matchup.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={matchup.status === 'completed' ? 'default' : 'outline'}>
                                    {matchup.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  <div className="font-medium">
                                    {matchup.home_team?.name} (Home)
                                  </div>
                                  <div className="text-sm text-muted-foreground">vs</div>
                                  <div className="font-medium">
                                    {matchup.away_team?.name} (Away)
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-center">
                                  {matchup.finalized ? (
                                    <div className="space-y-1">
                                      <div className="text-2xl font-bold">{matchup.home_matchup_wins}</div>
                                      <div className="text-sm text-muted-foreground">-</div>
                                      <div className="text-2xl font-bold">{matchup.away_matchup_wins}</div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="text-2xl font-bold text-muted-foreground">{matchup.home_matchup_wins || 0}</div>
                                      <div className="text-sm text-muted-foreground">-</div>
                                      <div className="text-2xl font-bold text-muted-foreground">{matchup.away_matchup_wins || 0}</div>
                                    </div>
                                  )}
                                </div>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/dashboard/leagues/${params.id}/matchup/${matchup.id}`);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standings" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Standings</CardTitle>
                  <CardDescription>Current league rankings</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareLeagueStandings}
                  disabled={standings.length === 0}
                  className="shrink-0"
                >
                  {standingsCopied ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {standings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No standings available yet. Complete some matches to see rankings.
                </div>
              ) : (
                <div className="space-y-2">
                  {standings.map((standing, index) => (
                    <div
                      key={standing.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${season.champion_team_id === standing.team_id
                        ? 'bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30'
                        : index < playoffCutoff && !season.playoffs_started
                          ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                          : ''
                        }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="font-bold text-lg w-8">#{index + 1}</div>
                        {season.champion_team_id === standing.team_id && (
                          <Trophy className="h-5 w-5 text-primary fill-primary" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {standing.team?.name}
                            {season.champion_team_id === standing.team_id && (
                              <Badge className="bg-gradient-to-r from-primary to-secondary text-white">
                                Champion
                              </Badge>
                            )}
                            {index < playoffCutoff && !season.playoffs_started && (
                              <Badge variant="outline" className="text-xs">
                                Playoff Position
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {season.use_points_system && (
                          <div className="text-center">
                            <div className="font-semibold">{standing.league_points}</div>
                            <div className="text-xs text-muted-foreground">Pts</div>
                          </div>
                        )}
                        <div className="text-center">
                          <div className="font-semibold">
                            {standing.matchup_wins}-{standing.matchup_losses}
                          </div>
                          <div className="text-xs text-muted-foreground">Matchup W-L</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">
                            {standing.match_wins}-{standing.match_losses}
                          </div>
                          <div className="text-xs text-muted-foreground">Match W-L</div>
                        </div>
                        <div className="text-center">
                          <div
                            className={`font-semibold ${standing.point_differential >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                          >
                            {standing.point_differential > 0 ? '+' : ''}
                            {standing.point_differential}
                          </div>
                          <div className="text-xs text-muted-foreground">Diff</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {playoffCutoff > 0 && playoffCutoff < standings.length && !season.playoffs_started && (
                    <div className="border-t-2 border-dashed border-primary my-2 relative">
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-background px-2 text-xs text-muted-foreground">
                        Playoff Cutoff
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {season.playoffs_started && (
          <TabsContent value="playoffs" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Playoff Bracket
                </CardTitle>
                <CardDescription>Championship tournament</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Playoff bracket will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showCreateWeekDialog} onOpenChange={setShowCreateWeekDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Week</DialogTitle>
            <DialogDescription>Add a new week to the league schedule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="weekNumber">Week Number</Label>
              <Input
                id="weekNumber"
                type="number"
                min="1"
                value={newWeekNumber || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value);
                  setNewWeekNumber(val as number);
                }}
                placeholder="-"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWeekDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createWeek}>Create Week</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Team</DialogTitle>
            <DialogDescription>Create a new team for this league</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name *</Label>
              <Input
                id="teamName"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder={`Team ${teams.length + 1}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamDescription">Description (Optional)</Label>
              <Input
                id="teamDescription"
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder="Brief team description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateTeamDialog(false);
              setNewTeamName('');
              setNewTeamDescription('');
            }}>
              Cancel
            </Button>
            <Button onClick={createTeam}>Create Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share League</DialogTitle>
            <DialogDescription>
              Share this link with players to invite them to join the league
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>League Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/leagues/${league?.id}`}
                  className="flex-1"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="icon"
                >
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone with this link can view the league and join teams
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowShareDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete League</DialogTitle>
            <DialogDescription>
              This will permanently delete this league and its seasons, teams, and schedule. You can only delete a league that does not have any recorded matchup scores.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLeague}
              disabled={deletingLeague}
            >
              {deletingLeague ? 'Deleting...' : 'Delete League'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
