'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PlayersPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    async function loadPlayers() {
      if (!user) return;
      const { data: userRole } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
      if (!userRole) return;

      const { data } = await supabase.from('players').select('*').eq('organization_id', (userRole as any).organization_id);
      if (data) setPlayers(data);
    }
    loadPlayers();
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Players</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>DUPR ID</TableHead>
              <TableHead>Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.id}>
                <TableCell>{player.first_name} {player.last_name}</TableCell>
                <TableCell>{player.email}</TableCell>
                <TableCell>{player.dupr_id || '-'}</TableCell>
                <TableCell>{Number(player.internal_rating).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
