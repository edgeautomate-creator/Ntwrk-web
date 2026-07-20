'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { Search, Trophy, Users, Calendar, Loader as Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

type SearchFilter = 'all' | 'pickup' | 'tournament' | 'league';

interface PickupResult {
  id: string;
  name: string;
  status: string;
  session_date: string | null;
  session_time: string | null;
  type: 'pickup';
  created_at: string;
}

interface TournamentResult {
  id: string;
  name: string;
  date: string | null;
  created_at: string;
  playoffs_started: boolean;
  type: 'tournament';
}

interface LeagueResult {
  id: string;
  name: string;
  league_name: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  type: 'league';
}

type SearchResult = PickupResult | TournamentResult | LeagueResult;

interface UniversalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UniversalSearchModal({ open, onOpenChange }: UniversalSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, filter]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const allResults: SearchResult[] = [];

      if (filter === 'all' || filter === 'pickup') {
        const { data: pickupData, error: pickupError } = await supabase
          .from('pickup_sessions')
          .select('id, name, status, session_date, session_time, created_at')
          .ilike('name', `%${searchQuery}%`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!pickupError && pickupData) {
          allResults.push(...pickupData.map(item => ({ ...item, type: 'pickup' as const })));
        }
      }

      if (filter === 'all' || filter === 'tournament') {
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('id, name, date, created_at, playoffs_started')
          .ilike('name', `%${searchQuery}%`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!tournamentError && tournamentData) {
          allResults.push(...tournamentData.map(item => ({ ...item, type: 'tournament' as const })));
        }
      }

      if (filter === 'all' || filter === 'league') {
        const { data: leagueData, error: leagueError } = await supabase
          .from('seasons')
          .select(`
            id,
            name,
            is_active,
            start_date,
            end_date,
            created_at,
            leagues!inner(name)
          `)
          .ilike('name', `%${searchQuery}%`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!leagueError && leagueData) {
          allResults.push(...leagueData.map(item => ({
            ...item,
            league_name: (item.leagues as any).name,
            type: 'league' as const
          })));
        }
      }

      allResults.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setResults(allResults.slice(0, 20));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'pickup') {
      router.push(`/dashboard/pickup/${result.id}`);
    } else if (result.type === 'tournament') {
      router.push(`/dashboard/tournaments/${result.id}`);
    } else if (result.type === 'league') {
      router.push(`/dashboard/leagues/${result.id}`);
    }
    onOpenChange(false);
  };

  const getStatusBadge = (result: SearchResult) => {
    if (result.type === 'pickup') {
      const status = result.status;
      return (
        <Badge variant={status === 'completed' ? 'secondary' : 'default'}>
          {status === 'active' ? 'Active' : status === 'completed' ? 'Completed' : 'Draft'}
        </Badge>
      );
    } else if (result.type === 'tournament') {
      return (
        <Badge variant={result.playoffs_started ? 'default' : 'secondary'}>
          {result.playoffs_started ? 'In Progress' : 'Scheduled'}
        </Badge>
      );
    } else if (result.type === 'league') {
      return (
        <Badge variant={result.is_active ? 'default' : 'secondary'}>
          {result.is_active ? 'Active' : 'Completed'}
        </Badge>
      );
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'pickup':
        return <Users className="h-5 w-5 text-[#5dd9a8]" />;
      case 'tournament':
        return <Trophy className="h-5 w-5 text-[#5dd9a8]" />;
      case 'league':
        return <Calendar className="h-5 w-5 text-[#5dd9a8]" />;
      default:
        return null;
    }
  };

  const getResultDate = (result: SearchResult) => {
    if (result.type === 'pickup' && result.session_date) {
      return format(new Date(result.session_date), 'MMM dd, yyyy');
    } else if (result.type === 'tournament' && result.date) {
      return format(new Date(result.date), 'MMM dd, yyyy');
    } else if (result.type === 'league' && result.start_date) {
      return format(new Date(result.start_date), 'MMM dd, yyyy');
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-[#374555] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">Search</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              placeholder="Search for pickup sessions, tournaments, or leagues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/50"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-[#5dd9a8] text-[#374555] hover:bg-[#4bc890]' : 'border-white/10 text-white hover:bg-white/5'}
            >
              All
            </Button>
            <Button
              variant={filter === 'pickup' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pickup')}
              className={filter === 'pickup' ? 'bg-[#5dd9a8] text-[#374555] hover:bg-[#4bc890]' : 'border-white/10 text-white hover:bg-white/5'}
            >
              <Users className="h-4 w-4 mr-1" />
              Pickup
            </Button>
            <Button
              variant={filter === 'tournament' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('tournament')}
              className={filter === 'tournament' ? 'bg-[#5dd9a8] text-[#374555] hover:bg-[#4bc890]' : 'border-white/10 text-white hover:bg-white/5'}
            >
              <Trophy className="h-4 w-4 mr-1" />
              Tournaments
            </Button>
            <Button
              variant={filter === 'league' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('league')}
              className={filter === 'league' ? 'bg-[#5dd9a8] text-[#374555] hover:bg-[#4bc890]' : 'border-white/10 text-white hover:bg-white/5'}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Leagues
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#5dd9a8]" />
              </div>
            ) : results.length > 0 ? (
              results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {getResultIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white truncate">
                          {result.name}
                        </h3>
                        {getStatusBadge(result)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <span className="capitalize">{result.type}</span>
                        {result.type === 'league' && (
                          <>
                            <span>•</span>
                            <span>{result.league_name}</span>
                          </>
                        )}
                        {getResultDate(result) && (
                          <>
                            <span>•</span>
                            <span>{getResultDate(result)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : searchQuery.trim() ? (
              <div className="text-center py-8 text-white/50">
                No results found for "{searchQuery}"
              </div>
            ) : (
              <div className="text-center py-8 text-white/50">
                Start typing to search for pickup sessions, tournaments, or leagues
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
