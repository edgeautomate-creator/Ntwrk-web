'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, X, Pencil, Trash2 } from 'lucide-react';
import { getDisplayName } from '@/lib/utils';

interface TournamentParticipant {
  id: string;
  user_id: string | null;
  player_name: string;
  dupr_id: string | null;
  dupr_rating: number | null;
  tournament_id: string;
}

interface PlayerRegistrationProps {
  tournamentId: string;
  players: TournamentParticipant[];
  capacity: number;
  format: 'singles' | 'doubles';
  isDuprRequired: boolean;
  isCreator: boolean;
  currentUserId: string | null;
  userProfile: any;
  onPlayersUpdated: () => void;
}

export function TournamentPlayerRegistration({
  tournamentId,
  players,
  capacity,
  format,
  isDuprRequired,
  isCreator,
  currentUserId,
  userProfile,
  onPlayersUpdated
}: PlayerRegistrationProps) {
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinMode, setJoinMode] = useState<'self' | 'manual'>('self');
  const [manualPlayerName, setManualPlayerName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');

  const isParticipant = players.some(p => p.user_id === currentUserId);
  const isFull = players.length >= capacity;

  const handleJoinTournament = async () => {
    if (!currentUserId) return;

    if (isFull) {
      alert('This tournament is full');
      return;
    }

    try {
      if (joinMode === 'self') {
        if (isDuprRequired && !userProfile?.dupr_id) {
          alert('You must link your DUPR account to join this tournament');
          return;
        }

        const displayName = getDisplayName({
          display_name: userProfile?.display_name,
          full_name: userProfile?.full_name,
          email: userProfile?.email
        }, 'Player');

        const duprRating = format === 'singles'
          ? userProfile?.dupr_singles_rating
          : userProfile?.dupr_doubles_rating;

        const { error } = await supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournamentId,
            user_id: currentUserId,
            status: 'approved'
          });

        if (error) throw error;
      } else {
        if (!manualPlayerName.trim()) {
          alert('Please enter a player name');
          return;
        }

        if (isDuprRequired) {
          alert('Cannot add manual players to DUPR-required tournaments');
          return;
        }

        const alreadyJoined = players.some(p =>
          p.player_name.toLowerCase() === manualPlayerName.trim().toLowerCase()
        );
        if (alreadyJoined) {
          alert('A player with this name has already joined');
          return;
        }

        const { error } = await supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournamentId,
            user_id: null,
            status: 'approved'
          });

        if (error) throw error;
      }

      setManualPlayerName('');
      setJoinMode('self');
      setShowJoinDialog(false);
      onPlayersUpdated();
    } catch (error: any) {
      console.error('Error joining tournament:', error);
      alert(error.message);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!confirm('Remove this player from the tournament?')) return;

    try {
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('id', playerId);

      if (error) throw error;

      onPlayersUpdated();
    } catch (error) {
      console.error('Error removing player:', error);
      alert('Failed to remove player');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              {players.length} / {capacity} registered
            </CardDescription>
          </div>
          {!isParticipant && !isFull && (
            <Button onClick={() => setShowJoinDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Join Tournament
            </Button>
          )}
          {isCreator && !isFull && (
            <Button onClick={() => {
              setJoinMode('manual');
              setShowJoinDialog(true);
            }} variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No players registered yet
          </p>
        ) : (
          <div className="space-y-2">
            {players.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  {editingPlayerId === player.id ? (
                    <Input
                      value={editingPlayerName}
                      onChange={(e) => setEditingPlayerName(e.target.value)}
                      onBlur={async () => {
                        if (editingPlayerName.trim()) {
                          // Update player name logic would go here
                        }
                        setEditingPlayerId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="h-8 w-48"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium">{player.player_name}</span>
                  )}
                  {player.dupr_rating && (
                    <Badge variant="secondary">
                      {player.dupr_rating.toFixed(2)} DUPR
                    </Badge>
                  )}
                  {player.user_id === currentUserId && (
                    <Badge>You</Badge>
                  )}
                </div>
                {isCreator && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePlayer(player.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Tournament</DialogTitle>
            <DialogDescription>
              {isCreator ? 'Add yourself or another player' : 'Register to participate'}
            </DialogDescription>
          </DialogHeader>

          {isCreator && (
            <div className="flex gap-2 mb-4">
              <Button
                variant={joinMode === 'self' ? 'default' : 'outline'}
                onClick={() => setJoinMode('self')}
                className="flex-1"
              >
                Add Yourself
              </Button>
              <Button
                variant={joinMode === 'manual' ? 'default' : 'outline'}
                onClick={() => setJoinMode('manual')}
                className="flex-1"
              >
                Add Another Player
              </Button>
            </div>
          )}

          {joinMode === 'manual' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playerName">Player Name</Label>
                <Input
                  id="playerName"
                  value={manualPlayerName}
                  onChange={(e) => setManualPlayerName(e.target.value)}
                  placeholder="Enter player name"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You will be registered as: {getDisplayName({
                  display_name: userProfile?.display_name,
                  full_name: userProfile?.full_name,
                  email: userProfile?.email
                }, 'Player')}
              </p>
              {isDuprRequired && !userProfile?.dupr_id && (
                <p className="text-sm text-destructive">
                  You must link your DUPR account to join this tournament
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoinTournament}>
              {joinMode === 'manual' ? 'Add Player' : 'Join'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
