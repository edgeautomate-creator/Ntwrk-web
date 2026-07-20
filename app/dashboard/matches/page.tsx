'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Trophy, Lock, Upload, Zap } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';

interface Match {
  id: string;
  match_date: string;
  court_number: string;
  status: string;
  is_public: boolean;
  team1: { name: string; player1: string; player2: string };
  team2: { name: string; player1: string; player2: string };
  games: any[];
  winner_team_id: string | null;
  division: { name: string };
}

export default function MatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinPassword, setJoinPassword] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [canStartPlayoffs, setCanStartPlayoffs] = useState(false);
  const [scores, setScores] = useState<{ game_number: number; team1_score: string; team2_score: string }[]>([
    { game_number: 1, team1_score: '', team2_score: '' },
    { game_number: 2, team1_score: '', team2_score: '' },
    { game_number: 3, team1_score: '', team2_score: '' },
  ]);

  useEffect(() => {
    if (!authLoading && user) {
      loadMatches();
    }
  }, [authLoading, user]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          match_date,
          court_number,
          status,
          is_public,
          winner_team_id,
          team1:team1_id (
            name,
            player1:player1_id (first_name, last_name),
            player2:player2_id (first_name, last_name)
          ),
          team2:team2_id (
            name,
            player1:player1_id (first_name, last_name),
            player2:player2_id (first_name, last_name)
          ),
          division:division_id (name),
          games (
            game_number,
            team1_score,
            team2_score,
            winner_team_id
          )
        `)
        .order('match_date', { ascending: true });

      if (error) throw error;

      const formattedMatches = data?.map((match: any) => ({
        id: match.id,
        match_date: match.match_date,
        court_number: match.court_number,
        status: match.status,
        is_public: match.is_public,
        winner_team_id: match.winner_team_id,
        team1: {
          name: match.team1.name || 'Team 1',
          player1: `${match.team1.player1.first_name} ${match.team1.player1.last_name}`,
          player2: `${match.team1.player2.first_name} ${match.team1.player2.last_name}`,
        },
        team2: {
          name: match.team2.name || 'Team 2',
          player1: `${match.team2.player1.first_name} ${match.team2.player1.last_name}`,
          player2: `${match.team2.player2.first_name} ${match.team2.player2.last_name}`,
        },
        division: { name: match.division.name },
        games: match.games || [],
      })) || [];

      setMatches(formattedMatches);

      const hasCompletedGames = formattedMatches.some(m => m.games.length > 0);
      setCanStartPlayoffs(hasCompletedGames);
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

  const handleStartPlayoffs = async () => {
    if (!confirm('Are you sure you want to start the playoffs? This will create playoff brackets based on current standings.')) {
      return;
    }

    setLoading(true);
    try {
      toast({
        title: 'Starting Playoffs',
        description: 'Playoff functionality will be implemented soon.',
      });
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

  const handleEnterScores = (match: Match) => {
    setSelectedMatch(match);

    if (match.games.length > 0) {
      const existingScores = match.games.map(g => ({
        game_number: g.game_number,
        team1_score: g.team1_score.toString(),
        team2_score: g.team2_score.toString(),
      }));
      setScores(existingScores);
    } else {
      setScores([
        { game_number: 1, team1_score: '', team2_score: '' },
        { game_number: 2, team1_score: '', team2_score: '' },
        { game_number: 3, team1_score: '', team2_score: '' },
      ]);
    }

    setScoreDialogOpen(true);
  };

  const handleSaveScores = async () => {
    if (!selectedMatch) return;

    setLoading(true);
    try {
      const { data: orgData } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!orgData) throw new Error('Organization not found');

      for (const score of scores) {
        const team1Score = parseInt(score.team1_score) || 0;
        const team2Score = parseInt(score.team2_score) || 0;

        const { data: existingGame } = await supabase
          .from('games')
          .select('id')
          .eq('match_id', selectedMatch.id)
          .eq('game_number', score.game_number)
          .maybeSingle();

        const winnerTeamId = team1Score > team2Score
          ? selectedMatch.team1
          : team2Score > team1Score
          ? selectedMatch.team2
          : null;

        if (existingGame) {
          await supabase
            .from('games')
            .update({
              team1_score: team1Score,
              team2_score: team2Score,
            })
            .eq('id', existingGame.id);
        } else {
          await supabase
            .from('games')
            .insert({
              match_id: selectedMatch.id,
              organization_id: orgData.organization_id,
              game_number: score.game_number,
              team1_score: team1Score,
              team2_score: team2Score,
            });
        }
      }

      const team1Wins = scores.filter(s => parseInt(s.team1_score) > parseInt(s.team2_score)).length;
      const team2Wins = scores.filter(s => parseInt(s.team2_score) > parseInt(s.team1_score)).length;

      const matchWinner = team1Wins > team2Wins ? 'team1' : team2Wins > team1Wins ? 'team2' : null;

      await supabase
        .from('matches')
        .update({ status: 'submitted' })
        .eq('id', selectedMatch.id);

      toast({
        title: 'Success',
        description: 'Scores saved successfully',
      });

      setScoreDialogOpen(false);
      await loadMatches();
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

  const handlePostToDupr = async (matchId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-submit-match`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ matchId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit match to DUPR');
      }

      toast({
        title: 'Success',
        description: result.message || 'Match submitted to DUPR successfully',
      });

      await loadMatches();
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      submitted: 'default',
      approved: 'default',
      confirmed: 'default',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Matches</h1>
          <p className="text-muted-foreground">View and manage match schedules and scores</p>
        </div>
        {canStartPlayoffs && (
          <Button onClick={handleStartPlayoffs} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
            <Zap className="mr-2 h-4 w-4" />
            Start Playoffs
          </Button>
        )}
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {matches.filter(m => m.status === 'pending' || m.status === 'confirmed').length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming matches
              </CardContent>
            </Card>
          ) : (
            matches
              .filter(m => m.status === 'pending' || m.status === 'confirmed')
              .map((match) => (
                <Card key={match.id} className="overflow-hidden border-l-4 border-l-orange-500">
                  <CardHeader className="pb-2 bg-muted/30">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(match.match_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Court {match.court_number}</span>
                        <span>•</span>
                        <span>{match.division.name}</span>
                      </div>
                      {getStatusBadge(match.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-lg font-semibold mb-1">
                          {match.team1.player1} / {match.team1.player2}
                        </div>
                      </div>
                      <div className="flex items-center justify-center px-4">
                        <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">VS</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-semibold mb-1 text-right">
                          {match.team2.player1} / {match.team2.player2}
                        </div>
                      </div>
                    </div>
                    <Button onClick={() => handleEnterScores(match)} className="w-full mt-4" variant="default">
                      Enter Scores
                    </Button>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {matches.filter(m => m.status === 'submitted' || m.status === 'approved').length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No completed matches
              </CardContent>
            </Card>
          ) : (
            matches
              .filter(m => m.status === 'submitted' || m.status === 'approved')
              .map((match) => (
                <Card key={match.id} className="overflow-hidden border-l-4 border-l-orange-500">
                  <CardHeader className="pb-2 bg-muted/30">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-3 w-3" />
                        <span>{new Date(match.match_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Court {match.court_number}</span>
                        <span>•</span>
                        <span>{match.division.name}</span>
                      </div>
                      {getStatusBadge(match.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-lg font-semibold mb-1">
                          {match.team1.player1} / {match.team1.player2}
                        </div>
                      </div>
                      <div className="flex items-center justify-center px-4">
                        <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">VS</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-semibold mb-1 text-right">
                          {match.team2.player1} / {match.team2.player2}
                        </div>
                      </div>
                    </div>

                    {match.games.length > 0 && (
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium text-muted-foreground">Match Results:</span>
                        </div>
                        {match.games.map((game) => (
                          <div key={game.game_number} className="flex justify-between items-center bg-muted/30 px-3 py-2 rounded">
                            <span className="text-sm font-medium">Game {game.game_number}</span>
                            <span className="text-xl font-bold">
                              {game.team1_score} - {game.team2_score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => handleEnterScores(match)} variant="outline" className="flex-1">
                        Edit Scores
                      </Button>
                      <Button
                        onClick={() => handlePostToDupr(match.id)}
                        className="flex-1"
                        disabled={loading}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Post to DUPR
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Enter Match Scores</DialogTitle>
            <DialogDescription>
              Enter the scores for each game in this match
            </DialogDescription>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team 1</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          {selectedMatch.team1.player1.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{selectedMatch.team1.player1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          {selectedMatch.team1.player2.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{selectedMatch.team1.player2}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team 2</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                          {selectedMatch.team2.player1.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{selectedMatch.team2.player1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                          {selectedMatch.team2.player2.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{selectedMatch.team2.player2}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                {scores.map((score, index) => (
                  <div key={score.game_number} className="space-y-2">
                    <Label className="text-sm font-semibold">Game {score.game_number}</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="number"
                        min="0"
                        placeholder="Score"
                        className="text-center text-lg font-semibold"
                        value={score.team1_score}
                        onChange={(e) => {
                          const newScores = [...scores];
                          newScores[index].team1_score = e.target.value;
                          setScores(newScores);
                        }}
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Score"
                        className="text-center text-lg font-semibold"
                        value={score.team2_score}
                        onChange={(e) => {
                          const newScores = [...scores];
                          newScores[index].team2_score = e.target.value;
                          setScores(newScores);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setScoreDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveScores} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Scores
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
