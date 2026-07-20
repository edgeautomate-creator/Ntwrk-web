'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getNextPlayoffRound } from '@/lib/playoff-reseeding';

export interface ReseedSurvivor {
  teamId: string;
  label: string;
  originalSeed: number | null;
}

interface PlayoffReseedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromRound: string | null;
  survivors: ReseedSurvivor[];
  generating?: boolean;
  onConfirm: (orderedTeamIds: string[]) => Promise<void>;
}

export function PlayoffReseedDialog({
  open,
  onOpenChange,
  fromRound,
  survivors,
  generating = false,
  onConfirm,
}: PlayoffReseedDialogProps) {
  const [orderedSurvivors, setOrderedSurvivors] = useState<ReseedSurvivor[]>([]);

  useEffect(() => {
    if (open) {
      setOrderedSurvivors(survivors);
    }
  }, [open, survivors]);

  const moveSurvivor = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedSurvivors.length) return;

    setOrderedSurvivors((current) => {
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  };

  const nextRound = fromRound ? getNextPlayoffRound(fromRound) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reseed for {nextRound ?? 'Next Round'}</DialogTitle>
          <DialogDescription>
            Rank the remaining players from best (#1) to worst. Matchups will pair the top seed
            against the lowest seed, and so on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {orderedSurvivors.map((survivor, index) => (
            <div
              key={survivor.teamId}
              className="flex items-center gap-3 rounded-lg border px-3 py-2"
            >
              <Badge variant="secondary" className="min-w-[2.5rem] justify-center">
                #{index + 1}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{survivor.label}</p>
                {survivor.originalSeed != null && (
                  <p className="text-xs text-muted-foreground">
                    Started as seed #{survivor.originalSeed}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === 0 || generating}
                  onClick={() => moveSurvivor(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === orderedSurvivors.length - 1 || generating}
                  onClick={() => moveSurvivor(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={generating || orderedSurvivors.length < 2}
            onClick={() => onConfirm(orderedSurvivors.map((survivor) => survivor.teamId))}
          >
            {generating ? 'Generating...' : `Generate ${nextRound ?? 'Next Round'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
