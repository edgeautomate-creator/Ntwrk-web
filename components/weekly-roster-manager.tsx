'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Users, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WeeklyRosterManagerProps {
  teamId: string;
  seasonId: string;
  isCaptain: boolean;
  maxPlayers: number;
}

interface Player {
  id: string;
  user_id: string;
  is_substitute: boolean;
  profiles?: {
    full_name: string | null;
    dupr_singles: number | null;
    dupr_doubles: number | null;
  };
}

interface Week {
  id: string;
  week_number: number;
  status: string;
}

export function WeeklyRosterManager({ teamId, seasonId, isCaptain, maxPlayers }: WeeklyRosterManagerProps) {
  const { toast } = useToast();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [regularPlayers, setRegularPlayers] = useState<Player[]>([]);
  const [substitutes, setSubstitutes] = useState<Player[]>([]);
  const [activeRoster, setActiveRoster] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [playerToSwap, setPlayerToSwap] = useState<string>('');
  const [substituteToAdd, setSubstituteToAdd] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [teamId, seasonId]);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekRoster();
    }
  }, [selectedWeek]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load weeks
      const { data: weeksData } = await supabase
        .from('league_weeks')
        .select('*')
        .eq('season_id', seasonId)
        .order('week_number', { ascending: true });

      if (weeksData) {
        setWeeks(weeksData);
        if (weeksData.length > 0 && !selectedWeek) {
          setSelectedWeek(weeksData[0].id);
        }
      }

      // Load regular players
      const { data: regularData } = await supabase
        .from('team_players')
        .select('*, profiles(*)')
        .eq('team_id', teamId)
        .eq('is_substitute', false);

      if (regularData) {
        setRegularPlayers(regularData);
      }

      // Load substitutes
      const { data: subsData } = await supabase
        .from('team_players')
        .select('*, profiles(*)')
        .eq('team_id', teamId)
        .eq('is_substitute', true);

      if (subsData) {
        setSubstitutes(subsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeekRoster = async () => {
    if (!selectedWeek) return;

    try {
      const { data } = await supabase
        .from('week_rosters')
        .select('player_user_id')
        .eq('league_week_id', selectedWeek)
        .eq('division_id', teamId)
        .eq('is_active', true);

      if (data && data.length > 0) {
        setActiveRoster(data.map(r => r.player_user_id));
      } else {
        // Default to all regular players
        setActiveRoster(regularPlayers.map(p => p.user_id));
      }
    } catch (error) {
      console.error('Error loading week roster:', error);
    }
  };

  const swapPlayer = async () => {
    if (!playerToSwap || !substituteToAdd || !selectedWeek) {
      toast({
        title: 'Error',
        description: 'Please select both a player and a substitute',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Remove the original player from active roster
      await supabase
        .from('week_rosters')
        .upsert({
          league_week_id: selectedWeek,
          division_id: teamId,
          player_user_id: playerToSwap,
          is_active: false,
        }, {
          onConflict: 'league_week_id,division_id,player_user_id'
        });

      // Add the substitute to active roster
      await supabase
        .from('week_rosters')
        .upsert({
          league_week_id: selectedWeek,
          division_id: teamId,
          player_user_id: substituteToAdd,
          is_active: true,
        }, {
          onConflict: 'league_week_id,division_id,player_user_id'
        });

      toast({
        title: 'Success',
        description: 'Roster updated successfully!',
      });

      setShowSwapDialog(false);
      setPlayerToSwap('');
      setSubstituteToAdd('');
      await loadWeekRoster();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addSubToRoster = async (subUserId: string) => {
    if (!selectedWeek) return;

    try {
      await supabase
        .from('week_rosters')
        .upsert({
          league_week_id: selectedWeek,
          division_id: teamId,
          player_user_id: subUserId,
          is_active: true,
        }, {
          onConflict: 'league_week_id,division_id,player_user_id'
        });

      toast({
        title: 'Success',
        description: 'Substitute added to roster!',
      });

      await loadWeekRoster();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeFromRoster = async (userId: string) => {
    if (!selectedWeek) return;

    try {
      await supabase
        .from('week_rosters')
        .upsert({
          league_week_id: selectedWeek,
          division_id: teamId,
          player_user_id: userId,
          is_active: false,
        }, {
          onConflict: 'league_week_id,division_id,player_user_id'
        });

      toast({
        title: 'Success',
        description: 'Player removed from roster!',
      });

      await loadWeekRoster();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isCaptain) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Roster</CardTitle>
          <CardDescription>Only team captains can manage the weekly roster</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activePlayersList = regularPlayers.filter(p => activeRoster.includes(p.user_id));
  const inactivePlayersList = regularPlayers.filter(p => !activeRoster.includes(p.user_id));
  const activeSubsList = substitutes.filter(p => activeRoster.includes(p.user_id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Roster Management</CardTitle>
        <CardDescription>Manage which players are active for each week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Week</label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Select a week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week) => (
                  <SelectItem key={week.id} value={week.id}>
                    Week {week.week_number}
                    {week.status === 'completed' && ' (Completed)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedWeek && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Active Roster ({activePlayersList.length + activeSubsList.length}/{maxPlayers})</h3>
                  <Button size="sm" variant="outline" onClick={() => setShowSwapDialog(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Swap Player
                  </Button>
                </div>

                {activePlayersList.length === 0 && activeSubsList.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No active players for this week. Add players from the roster below.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {activePlayersList.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{player.profiles?.full_name || 'Unknown'}</div>
                            {player.profiles?.dupr_singles && (
                              <div className="text-sm text-muted-foreground">
                                DUPR: {player.profiles.dupr_singles}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromRoster(player.user_id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}

                    {activeSubsList.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-950">
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {sub.profiles?.full_name || 'Unknown'}
                              <Badge variant="outline" className="text-xs">Substitute</Badge>
                            </div>
                            {sub.profiles?.dupr_singles && (
                              <div className="text-sm text-muted-foreground">
                                DUPR: {sub.profiles.dupr_singles}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromRoster(sub.user_id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {inactivePlayersList.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Inactive Players</h3>
                  <div className="space-y-2">
                    {inactivePlayersList.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{player.profiles?.full_name || 'Unknown'}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addSubToRoster(player.user_id)}
                        >
                          Add to Roster
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {substitutes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Available Substitutes</h3>
                  <div className="space-y-2">
                    {substitutes.filter(s => !activeRoster.includes(s.user_id)).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{sub.profiles?.full_name || 'Unknown'}</div>
                            {sub.profiles?.dupr_singles && (
                              <div className="text-sm text-muted-foreground">
                                DUPR: {sub.profiles.dupr_singles}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addSubToRoster(sub.user_id)}
                        >
                          Add to Roster
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Swap Player with Substitute</DialogTitle>
            <DialogDescription>
              Select a player to remove and a substitute to add
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Player to Remove</label>
              <Select value={playerToSwap} onValueChange={setPlayerToSwap}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {activePlayersList.map((player) => (
                    <SelectItem key={player.user_id} value={player.user_id}>
                      {player.profiles?.full_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Substitute to Add</label>
              <Select value={substituteToAdd} onValueChange={setSubstituteToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Select substitute" />
                </SelectTrigger>
                <SelectContent>
                  {substitutes.map((sub) => (
                    <SelectItem key={sub.user_id} value={sub.user_id}>
                      {sub.profiles?.full_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={swapPlayer}>
              <Check className="h-4 w-4 mr-2" />
              Confirm Swap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
