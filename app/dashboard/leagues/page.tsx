'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trophy, Calendar, Loader as Loader2, Users } from 'lucide-react';

export default function LeaguesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    leagueName: '',
    description: '',
    type: 'league',
    format: 'doubles',
    startDate: '',
    endDate: '',
    hasPlayoffs: false,
    rounds: 1,
    autoGenerateSchedule: false,
    scoringFormat: '11',
    winByMargin: 2,
    bestOf: '3',
    maxTeams: 8,
    playoffTeams: 4,
    playoffFormat: 'single_elimination',
  });

  useEffect(() => {
    loadLeagues();
  }, [user]);

  const loadLeagues = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole) return;

      const { data, error } = await supabase
        .from('leagues')
        .select(`
          *,
          seasons (
            id,
            name,
            start_date,
            end_date,
            type,
            format,
            has_playoffs,
            is_active,
            max_teams
          )
        `)
        .eq('organization_id', userRole.organization_id);

      if (error) throw error;

      setLeagues(data || []);
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

  const handleCreateLeague = async () => {
    setLoading(true);
    try {
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (roleError) {
        console.error('Role query error:', roleError);
        throw new Error(`Failed to fetch organization: ${roleError.message}`);
      }

      if (!userRole) {
        throw new Error('Organization not found. Please contact support.');
      }

      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          organization_id: userRole.organization_id,
          name: formData.leagueName,
          description: formData.description,
          is_public: true,
        })
        .select()
        .single();

      if (leagueError) throw leagueError;

      const seasonName = formData.startDate
        ? `${new Date(formData.startDate).getFullYear()} Season`
        : `${new Date().getFullYear()} Season`;

      const { data: season, error: seasonError } = await supabase
        .from('seasons')
        .insert({
          league_id: league.id,
          organization_id: userRole.organization_id,
          name: seasonName,
          start_date: formData.startDate || null,
          end_date: formData.endDate || null,
          type: formData.type,
          format: formData.format,
          max_teams: formData.maxTeams,
          has_playoffs: formData.hasPlayoffs,
          rounds: formData.rounds,
          auto_generate_schedule: formData.autoGenerateSchedule,
          scoring_format: formData.scoringFormat,
          win_by_margin: formData.winByMargin,
          best_of: parseInt(formData.bestOf),
          is_active: true,
        })
        .select()
        .single();

      if (seasonError) throw seasonError;

      toast({
        title: 'Success',
        description: `${formData.type === 'league' ? 'League' : 'Tournament'} created successfully`,
      });

      setDialogOpen(false);
      setFormData({
        leagueName: '',
        description: '',
        type: 'league',
        format: 'doubles',
        startDate: '',
        endDate: '',
        hasPlayoffs: false,
        rounds: 1,
        autoGenerateSchedule: false,
        scoringFormat: '11',
        winByMargin: 2,
        bestOf: '3',
        maxTeams: 8,
        playoffTeams: 4,
        playoffFormat: 'single_elimination',
      });

      await loadLeagues();
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
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Leagues</h1>
            <p className="text-white/70">Create and manage your pickleball competitions</p>
          </div>
          <Button
            className="bg-[#5dd9a8] hover:bg-[#4bc998] text-white"
            onClick={() => router.push('/dashboard/leagues/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New League
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#5dd9a8] hover:bg-[#4bc998] text-white" style={{ display: 'none' }}>
                <Plus className="mr-2 h-4 w-4" />
                Create New
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create League</DialogTitle>
              <DialogDescription>
                Set up a new pickleball competition with customizable options
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="pb-3 border-b">
                  <h3 className="font-semibold text-lg">Basic Information</h3>
                  <p className="text-sm text-muted-foreground">Set up your competition details</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Competition Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="league">League (Round Robin)</SelectItem>
                      <SelectItem value="tournament">Tournament (Bracket)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leagueName">
                    {formData.type === 'league' ? 'League' : 'Tournament'} Name
                  </Label>
                  <Input
                    id="leagueName"
                    value={formData.leagueName}
                    onChange={(e) => setFormData({ ...formData, leagueName: e.target.value })}
                    placeholder="e.g., Summer Pickleball League"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your competition..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pb-3 border-b mt-6">
                  <h3 className="font-semibold text-lg">League Settings</h3>
                  <p className="text-sm text-muted-foreground">Configure format and team limits</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(value) => setFormData({ ...formData, format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singles">Singles (1 player per team)</SelectItem>
                      <SelectItem value="doubles">Doubles (2 players per team)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTeams">Max Teams</Label>
                  <Input
                    id="maxTeams"
                    type="number"
                    min="2"
                    value={formData.maxTeams}
                    onChange={(e) => setFormData({ ...formData, maxTeams: parseInt(e.target.value) || 8 })}
                  />
                </div>

                <div className="pb-3 border-b mt-6">
                  <h3 className="font-semibold text-lg">Game Rules</h3>
                  <p className="text-sm text-muted-foreground">Define scoring and match format</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scoringFormat">Scoring Format</Label>
                  <Select
                    value={formData.scoringFormat}
                    onValueChange={(value) => setFormData({ ...formData, scoringFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11">Play to 11</SelectItem>
                      <SelectItem value="15">Play to 15</SelectItem>
                      <SelectItem value="21">Play to 21</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="winByMargin">Win by Margin</Label>
                    <Input
                      id="winByMargin"
                      type="number"
                      min="1"
                      value={formData.winByMargin}
                      onChange={(e) => setFormData({ ...formData, winByMargin: parseInt(e.target.value) || 2 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bestOf">Match Format</Label>
                    <Select
                      value={formData.bestOf}
                      onValueChange={(value) => setFormData({ ...formData, bestOf: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Best of 1</SelectItem>
                        <SelectItem value="3">Best of 3</SelectItem>
                        <SelectItem value="5">Best of 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pb-3 border-b mt-6">
                  <h3 className="font-semibold text-lg">Additional Options</h3>
                  <p className="text-sm text-muted-foreground">Configure playoffs and scheduling</p>
                </div>

                {formData.type === 'tournament' && (
                  <div className="space-y-2">
                    <Label htmlFor="rounds">Number of Rounds</Label>
                    <Input
                      id="rounds"
                      type="number"
                      min="1"
                      value={formData.rounds}
                      onChange={(e) => setFormData({ ...formData, rounds: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Playoffs</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable playoff rounds after regular season
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasPlayoffs}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasPlayoffs: checked })}
                  />
                </div>

                {formData.hasPlayoffs && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="playoffTeams">Playoff Teams</Label>
                      <Input
                        id="playoffTeams"
                        type="number"
                        min="2"
                        max={formData.maxTeams}
                        value={formData.playoffTeams}
                        onChange={(e) => setFormData({ ...formData, playoffTeams: parseInt(e.target.value) || 4 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="playoffFormat">Playoff Format</Label>
                      <Select
                        value={formData.playoffFormat}
                        onValueChange={(value) => setFormData({ ...formData, playoffFormat: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_elimination">Single Elimination</SelectItem>
                          <SelectItem value="double_elimination">Double Elimination</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Auto-Generate Schedule</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically create match schedule
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoGenerateSchedule}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoGenerateSchedule: checked })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreateLeague} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create {formData.type === 'league' ? 'League' : 'Tournament'}
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </div>

        {loading && leagues.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-[#5dd9a8]" />
          </div>
        ) : leagues.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-white/50" />
              <p className="text-lg font-semibold mb-2 text-white">No leagues or tournaments yet</p>
              <p className="text-white/70 mb-4">
                Create your first competition to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {leagues.map((league) => (
              <Card
                key={league.id}
                className="bg-white/5 border-white/10 cursor-pointer hover:border-[#5dd9a8]/50 transition-all"
                onClick={() => router.push(`/dashboard/leagues/${league.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl flex items-center gap-2 text-white">
                      <Trophy className="h-5 w-5 text-[#5dd9a8]" />
                      {league.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-white/70">{league.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {league.seasons && league.seasons.length > 0 && (
                    <div className="space-y-3">
                      {league.seasons.map((season: any) => (
                        <div key={season.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {season.type === 'tournament' && (
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                  Tournament
                                </span>
                              )}
                              {season.has_playoffs && (
                                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                                  Playoffs
                                </span>
                              )}
                              {season.is_active && (
                                <span className="text-xs bg-[#5dd9a8]/20 text-[#5dd9a8] px-2 py-1 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-white/60 space-y-1">
                            <p className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-[#5dd9a8]" />
                              {new Date(season.start_date).toLocaleDateString()} -{' '}
                              {season.end_date ? new Date(season.end_date).toLocaleDateString() : 'Ongoing'}
                            </p>
                            <p>
                              <Users className="h-4 w-4 text-[#5dd9a8] inline mr-2" />
                              {season.format === 'singles' ? 'Singles' : 'Doubles'}
                              {season.max_teams && ` • Max ${season.max_teams} teams`}
                            </p>
                            <p>
                              Scoring: Play to {season.scoring_format}, Win by {season.win_by_margin}
                              {season.best_of && ` • Best of ${season.best_of}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
