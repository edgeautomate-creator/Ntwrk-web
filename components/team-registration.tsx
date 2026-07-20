'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDisplayName } from '@/lib/utils';

interface TeamRegistrationProps {
  teamId: string;
  teamName: string;
  maxPlayers: number;
  organizationId: string;
  isAdmin?: boolean;
}

interface TeamPlayer {
  position: number;
  player_id: string | null;
  first_name: string | null;
  last_name: string | null;
  dupr_id: string | null;
  name:string|null;
  dupr_singles_rating: number | null;
}

interface TeamData {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  team_players: {
      profiles: any;
  }[];
}

export function TeamRegistration({
  teamId,
  teamName,
  maxPlayers,
  organizationId,
  isAdmin = false
}: TeamRegistrationProps) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayers();
  }, [teamId]);

  const loadPlayers = async () => {
    try {
      
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          id,
          player1_id,
          player2_id,
          player3_id,
          player4_id,
          team_players (profiles (*))
        `)
        .eq('id', teamId)
        .single() as { data: TeamData | null; error: any };

      if (teamError) throw teamError;
      if (!teamData) {
        setPlayers([]);
        return;
      }

      const playerIds = [
        teamData.player1_id,
        teamData.player2_id,
        teamData.player3_id,
        teamData.player4_id,
      ].filter(Boolean);


      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, first_name, last_name, dupr_id')
        .in('id', playerIds);

      if (playersError) throw playersError;

      const playersMap = new Map(
        (playersData || []).map(p => [p.id, p])
      );

      const transformedPlayers: TeamPlayer[] = [];

      [teamData.player1_id, teamData.player2_id, teamData.player3_id, teamData.player4_id]
      .forEach((playerId, index) => {
        // if (!playerId) return;
      
        const player = playersMap.get(playerId);
        
        // if (!player) return;
      
        const rating =
          teamData.team_players?.[index]?.profiles?.dupr_singles_rating ?? null;
        const name =teamData.team_players?.[index]?.profiles?.email? getDisplayName({email: teamData.team_players?.[index]?.profiles?.email}) : "Available slot";
        
        transformedPlayers.push({
          position: index + 1,
          player_id:  player?.id,
          name:name,
          first_name: player?.first_name,
          last_name: player?.last_name,
          dupr_id: player?.dupr_id,
          dupr_singles_rating: rating,
        });
      });
      console.log("transformedPlayers :",transformedPlayers)
      setPlayers(transformedPlayers);
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

  const availableSlots = maxPlayers - players.length;

  if (loading) {
    return <div>Loading team roster...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Roster
          </CardTitle>
          <CardDescription>
            {players.length} of {maxPlayers} players registered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Players */}
          <div className="space-y-3">
            {Array.from({ length: maxPlayers }, (_, i) => i + 1).map((position) => {
              const player = players.find(p => p.position === position);

              return (
                <div
                  key={position}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      {position}
                    </div>
                    <div>
                      {player ? (
                        <>
                          <p className="font-medium">
                            {/* {player.first_name} {player.last_name} */}
                            {player?.name}
                          </p>
                          {player.dupr_singles_rating && (
                            <p className="text-sm text-muted-foreground">
                              DUPR: {player.dupr_singles_rating}
                            </p>
                          )}
                          {player.dupr_id && (
                            <p className="text-sm text-muted-foreground">
                              DUPR: {player.dupr_id}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground">Available slot</p>
                      )}
                    </div>
                  </div>

                  {!player && isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Player
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {availableSlots > 0 && isAdmin && (
            <Alert>
              <UserPlus className="h-4 w-4" />
              <AlertDescription>
                {availableSlots} {availableSlots === 1 ? 'slot' : 'slots'} available.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
