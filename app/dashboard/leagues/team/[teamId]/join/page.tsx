'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users } from 'lucide-react';

interface TeamInfo {
  id: string;
  name: string;
  season_id: string;
  organization_id: string;
  seasons: {
    name: string;
    players_per_team: number;
    leagues: {
      name: string;
    };
  };
}

export default function JoinTeamPage({ params }: { params: { teamId: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadTeamInfo();
    }
  }, [params.teamId, user]);

  const loadTeamInfo = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('divisions')
        .select(`
          id,
          name,
          season_id,
          organization_id
        `)
        .eq('id', params.teamId)
        .single();

      if (teamError) throw teamError;

      // Fetch season data separately
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select(`
          name,
          players_per_team,
          league_id
        `)
        .eq('id', teamData.season_id)
        .single();

      if (seasonError) throw seasonError;

      // Fetch league data
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('name')
        .eq('id', seasonData.league_id)
        .single();

      if (leagueError) throw leagueError;

      // Transform the data to match our interface
      const transformedData: TeamInfo = {
        id: teamData.id,
        name: teamData.name,
        season_id: teamData.season_id,
        organization_id: teamData.organization_id,
        seasons: {
          name: seasonData.name,
          players_per_team: seasonData.players_per_team,
          leagues: {
            name: leagueData.name
          }
        }
      };

      setTeam(transformedData);

      // Load current player count
      const { count, error: countError } = await supabase
        .from('team_players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', params.teamId)
        .eq('is_substitute', false);

      if (countError) throw countError;
      setPlayerCount(count || 0);
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

  const handleJoin = async () => {
    if (!user || !team) return;

    setJoining(true);
    try {
      // Check if user is already on team
      const { data: existing } = await supabase
        .from('team_players')
        .select('id')
        .eq('team_id', params.teamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Already Joined',
          description: "You're already on this team",
        });
        router.push(`/dashboard/leagues/team/${params.teamId}`);
        return;
      }

      // Find next available position
      const nextPosition = playerCount + 1;

      if (nextPosition > team.seasons.players_per_team) {
        toast({
          title: 'Team Full',
          description: 'This team is already full',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('team_players')
        .insert({
          team_id: params.teamId,
          user_id: user.id,
          organization_id: team.organization_id,
          player_position: nextPosition,
          is_captain: playerCount === 0, // First player becomes captain
          is_substitute: false,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `You've joined ${team.name}!`,
      });

      router.push(`/dashboard/leagues/team/${params.teamId}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <p>Loading team information...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Team Not Found</CardTitle>
              <CardDescription>
                The team you're looking for doesn't exist or has been removed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/dashboard/leagues')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Leagues
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const availableSlots = team.seasons.players_per_team - playerCount;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/leagues')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Leagues
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              Join {team.name}
            </CardTitle>
            <CardDescription>
              {team.seasons.leagues.name} - {team.seasons.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold mb-3">Team Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Name:</span>
                  <span className="font-medium">{team.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">League:</span>
                  <span className="font-medium">{team.seasons.leagues.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Season:</span>
                  <span className="font-medium">{team.seasons.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Players:</span>
                  <span className="font-medium">
                    {playerCount} / {team.seasons.players_per_team}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Slots:</span>
                  <span className="font-medium">{availableSlots}</span>
                </div>
              </div>
            </div>

            {availableSlots > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click the button below to join this team and start playing in the league.
                </p>
                <Button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full"
                  size="lg"
                >
                  {joining ? 'Joining...' : 'Join Team'}
                </Button>
              </div>
            ) : (
              <div className="p-4 border rounded-lg bg-destructive/10">
                <p className="text-sm font-medium">Team is Full</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This team has reached its maximum capacity. Please contact the league
                  administrator for more information.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
