'use client';

import { useState } from 'react';
import { TournamentMatch, TournamentTeam } from '@/app/dashboard/tournaments/[id]/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Trash2 } from 'lucide-react';

interface PlayoffBracketProps {
  matches: TournamentMatch[];
  onMatchClick: (match: TournamentMatch) => void;
  onDeleteMatch?: (match: TournamentMatch) => void;
  isSingles?: boolean;
  isCreator?: boolean;
  bestOf?: number;
}

export function PlayoffBracket({ matches, onMatchClick, onDeleteMatch, isSingles = false, isCreator = false, bestOf = 3 }: PlayoffBracketProps) {
  const matchesByRound = matches.reduce((acc, match) => {
    const round = match.playoff_round || 'Playoffs';
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<string, TournamentMatch[]>);

  const roundOrder = [
    'Round of 32', 'Round of 16', 'First Round',
    'Quarterfinals', 'Semifinals', 'Finals',
  ];
  const sortedRounds = Object.keys(matchesByRound).sort((a, b) => {
    const idxA = roundOrder.indexOf(a);
    const idxB = roundOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return 1;
    if (idxB !== -1) return -1;
    return a.localeCompare(b);
  });

  // Default to the earliest round with incomplete matches, else the last round
  const defaultRound = sortedRounds.find(r =>
    matchesByRound[r].some(m => m.status !== 'completed')
  ) || sortedRounds[sortedRounds.length - 1] || '';

  const [activeRound, setActiveRound] = useState(defaultRound);

  const getTeamDisplay = (team: TournamentTeam | undefined) => {
    if (!team) return 'TBD';
    if (isSingles) return team.player1_name || 'Player 1';
    const p1 = team.player1_name || 'Player 1';
    return team.player2_name ? `${p1} / ${team.player2_name}` : p1;
  };

  const getSeedBadge = (seed: number | null | undefined) => {
    if (!seed) return null;
    return (
      <Badge variant="secondary" className="text-xs font-semibold px-1.5 py-0">
        #{seed}
      </Badge>
    );
  };

  const getGameScores = (match: TournamentMatch) => {
    const allScores = [
      { team1: match.game1_team1_points, team2: match.game1_team2_points },
      { team1: match.game2_team1_points, team2: match.game2_team2_points },
      { team1: match.game3_team1_points, team2: match.game3_team2_points },
      { team1: match.game4_team1_points, team2: match.game4_team2_points },
      { team1: match.game5_team1_points, team2: match.game5_team2_points },
    ];
    return allScores.slice(0, bestOf);
  };

  const renderGameBoxes = (match: TournamentMatch, perspective: 'team1' | 'team2') => {
    const scores = getGameScores(match);
    return (
      <div className="flex items-center gap-1">
        {scores.map((game, idx) => {
          if (game.team1 == null || game.team2 == null) {
            return match.status === 'completed' ? null : (
              <div key={idx} className="w-9 h-9 flex items-center justify-center rounded bg-muted/50 text-muted-foreground font-semibold text-sm">
                -
              </div>
            );
          }
          const won = perspective === 'team1' ? game.team1 > game.team2 : game.team2 > game.team1;
          const score = perspective === 'team1' ? game.team1 : game.team2;
          return (
            <div
              key={idx}
              className={`w-9 h-9 flex items-center justify-center rounded font-semibold text-sm ${
                won ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {score}
            </div>
          );
        })}
      </div>
    );
  };

  if (sortedRounds.length === 0) return null;

  return (
    <Tabs value={activeRound} onValueChange={setActiveRound}>
      <TabsList className="mb-4">
        {sortedRounds.map(round => {
          const allDone = matchesByRound[round].every(m => m.status === 'completed');
          return (
            <TabsTrigger key={round} value={round} className="flex items-center gap-1.5">
              {round}
              {round === 'Finals' && <Trophy className="h-3.5 w-3.5 text-yellow-500" />}
              {allDone && (
                <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block" />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {sortedRounds.map(round => (
        <TabsContent key={round} value={round}>
          <div className="flex flex-col gap-4">
            {matchesByRound[round].map((match) => (
              <div
                key={match.id}
                className={`border rounded-lg transition-all hover:shadow-md ${
                  match.status === 'completed'
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'border-muted hover:border-primary/30 bg-card'
                }`}
              >
                <div className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      {match.status === 'completed' ? (
                        <Badge className="bg-green-600 text-xs">Final</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                      )}
                    </div>
                    {isCreator && onDeleteMatch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 -mt-1 -mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMatch(match);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="cursor-pointer space-y-2" onClick={() => onMatchClick(match)}>
                    {/* Team 1 row */}
                    <div
                      className={`flex items-center justify-between p-2 rounded ${
                        match.status === 'completed' && match.winner_team_id === match.team1_id
                          ? 'bg-green-500/20 border border-green-500/50'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {getSeedBadge(match.seeding_position_team1)}
                        <span className="text-base font-medium truncate">{getTeamDisplay(match.team1)}</span>
                      </div>
                      {renderGameBoxes(match, 'team1')}
                    </div>

                    {/* Team 2 row */}
                    <div
                      className={`flex items-center justify-between p-2 rounded ${
                        match.status === 'completed' && match.winner_team_id === match.team2_id
                          ? 'bg-green-500/20 border border-green-500/50'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {getSeedBadge(match.seeding_position_team2)}
                        <span className="text-base font-medium truncate">{getTeamDisplay(match.team2)}</span>
                      </div>
                      {renderGameBoxes(match, 'team2')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
