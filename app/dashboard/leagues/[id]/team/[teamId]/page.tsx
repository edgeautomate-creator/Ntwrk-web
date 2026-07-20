'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CircleAlert as AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TeamRegistration } from '@/components/team-registration';

interface TeamData {
  id: string;
  name: string;
  season_id: string;
  organization_id: string;
  seasons: {
    name: string;
    players_per_team: number;
    league_id: string;
    leagues: {
      name: string;
    };
  };
}

export default function TeamRosterPage({ params }: { params: { id: string; teamId: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadTeamData();
  }, [params.teamId]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, name, season_id, organization_id')
        .eq('id', params.teamId)
        .single();

      if (teamError) throw teamError;
      if (!teamData) throw new Error('Team not found');

      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('name, players_per_team, league_id')
        .eq('id', teamData.season_id)
        .single();

      if (seasonError) throw seasonError;
      if (!seasonData) throw new Error('Season not found');

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('name')
        .eq('id', seasonData.league_id)
        .single();

      if (leagueError) throw leagueError;
      if (!leagueData) throw new Error('League not found');

      const transformedData: TeamData = {
        id: teamData.id,
        name: teamData.name,
        season_id: teamData.season_id,
        organization_id: teamData.organization_id,
        seasons: {
          name: seasonData.name,
          players_per_team: seasonData.players_per_team,
          league_id: seasonData.league_id,
          leagues: {
            name: leagueData.name
          }
        }
      };

      setTeam(transformedData);

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('organization_id', teamData.organization_id)
        .maybeSingle();

      setIsAdmin(userRole?.role === 'admin' || userRole?.role === 'organizer');
    } catch (error: any) {
      console.error('Error loading team:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Team not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push(`/dashboard/leagues/${params.id}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to League
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <p className="text-muted-foreground">
            {team.seasons.leagues.name} - {team.seasons.name}
          </p>
        </div>
      </div>

      <TeamRegistration
        teamId={team.id}
        teamName={team.name}
        // seasonId={team.season_id}
        maxPlayers={team.seasons.players_per_team}
        organizationId={team.organization_id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
