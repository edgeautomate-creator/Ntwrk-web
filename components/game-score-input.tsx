'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Loader as Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GameScoreInputProps {
  gameNumber: number;
  team1Name: string;
  team2Name: string;
  team1Score: number | null;
  team2Score: number | null;
  isCompleted: boolean;
  isDisabled: boolean;
  onScoreChange?: (gameNumber: number, team1Points: string, team2Points: string) => void;
  canEdit: boolean;
  matchDecided?: boolean;
}

export function GameScoreInput({
  gameNumber,
  team1Name,
  team2Name,
  team1Score,
  team2Score,
  isCompleted,
  isDisabled,
  onScoreChange,
  canEdit,
  matchDecided = false,
}: GameScoreInputProps) {
  const [team1Points, setTeam1Points] = useState(team1Score?.toString() || '');
  const [team2Points, setTeam2Points] = useState(team2Score?.toString() || '');

  const handleTeam1Change = (value: string) => {
    setTeam1Points(value);
    onScoreChange?.(gameNumber, value, team2Points);
  };

  const handleTeam2Change = (value: string) => {
    setTeam2Points(value);
    onScoreChange?.(gameNumber, team1Points, value);
  };

  const showInputs = !isCompleted || canEdit;
  const isGameDisabled = isDisabled;

  return (
    <div className={`rounded-lg border p-4 ${isGameDisabled ? 'opacity-50' : ''} ${isCompleted ? 'bg-muted/30' : 'bg-background'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2">
          Game {gameNumber}
          {isCompleted && (
            <Badge variant="default" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
          {matchDecided && !isCompleted && (
            <Badge variant="secondary" className="text-xs">
              Not Needed
            </Badge>
          )}
        </h4>
        {isCompleted && team1Score !== null && team2Score !== null && (
          <div className="text-sm font-medium">
            {team1Score} - {team2Score}
          </div>
        )}
      </div>

      {showInputs ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`game${gameNumber}-team1`} className="text-xs">
                {team1Name}
              </Label>
              <Input
                id={`game${gameNumber}-team1`}
                type="number"
                min="0"
                value={team1Points}
                onChange={(e) => handleTeam1Change(e.target.value)}
                disabled={isGameDisabled}
                placeholder="-"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`game${gameNumber}-team2`} className="text-xs">
                {team2Name}
              </Label>
              <Input
                id={`game${gameNumber}-team2`}
                type="number"
                min="0"
                value={team2Points}
                onChange={(e) => handleTeam2Change(e.target.value)}
                disabled={isGameDisabled}
                placeholder="-"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
