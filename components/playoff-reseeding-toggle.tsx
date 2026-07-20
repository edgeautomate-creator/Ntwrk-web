'use client';

import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PlayoffReseedingToggleProps {
  tournamentId: string;
  enabled: boolean;
  disabled?: boolean;
  onUpdated: (enabled: boolean) => void;
}

export function PlayoffReseedingToggle({
  tournamentId,
  enabled,
  disabled = false,
  onUpdated,
}: PlayoffReseedingToggleProps) {
  const [checked, setChecked] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setChecked(enabled);
  }, [enabled]);

  const handleChange = async (next: boolean) => {
    const previous = checked;
    setChecked(next);

    try {
      setSaving(true);
      const { error } = await supabase
        .from('tournaments')
        .update({ playoff_reseeding: next })
        .eq('id', tournamentId);

      if (error) throw error;

      onUpdated(next);
      toast({
        description: next
          ? 'Reseeding between rounds is now on'
          : 'Reseeding between rounds is now off',
      });
    } catch (error) {
      setChecked(previous);
      console.error('Error updating playoff reseeding:', error);
      toast({
        description: 'Failed to update reseeding setting',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={`playoff-reseeding-${tournamentId}`}>Reseed Between Rounds</Label>
        <p className="text-sm text-muted-foreground">
          Re-rank remaining players between playoff rounds so top seeds avoid each other early
        </p>
      </div>
      <Switch
        id={`playoff-reseeding-${tournamentId}`}
        checked={checked}
        disabled={disabled || saving}
        onCheckedChange={handleChange}
      />
    </div>
  );
}
