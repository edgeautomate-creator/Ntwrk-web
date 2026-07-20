  'use client';
  
  import { useState, useEffect } from 'react';
  import { supabase } from '@/lib/supabase/client';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { useToast } from '@/hooks/use-toast';
  import { Loader as Loader2, CircleCheck as CheckCircle2, Link as LinkIcon, Unlink, Search, CircleAlert as AlertCircle, LogIn, LogOut, RefreshCw, User, CreditCard as Edit, MapPin, Trophy, Calendar, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { useAuth } from '@/lib/contexts/auth-context';
  import { DUPRLoginButton } from '@/components/dupr-login-modal';
  import { useRouter } from 'next/navigation';
  import { getDisplayName } from '@/lib/utils';
  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
  import { format } from 'date-fns';
  export default function ProfilePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [duprConnected, setDuprConnected] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [editingDisplayName, setEditingDisplayName] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [savingDisplayName, setSavingDisplayName] = useState(false);
    const [upcomingTournaments, setUpcomingTournaments] = useState<any[]>([]);
    const [gamesThisWeek, setGamesThisWeek] = useState(0);
    const [gamesThisMonth, setGamesThisMonth] = useState(0);
    const [gamesTotal, setGamesTotal] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
    useEffect(() => {
      loadProfileData();
      loadUpcomingTournaments();
      loadGameStats();
    }, [user]);
  
    useEffect(() => {
      const syncClubsIfNeeded = async () => {
        if (!user || !profileData?.dupr_id) return;
  
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
  
        const { data: existingClubs } = await supabase
          .from('user_dupr_clubs')
          .select('id')
          .eq('dupr_id', profileData.dupr_id)
          .limit(1);
  
        if (!existingClubs || existingClubs.length === 0) {
          console.log('DUPR connected but no clubs found, syncing...');
          const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-user-clubs`;
          try {
            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            });
  
            if (response.ok) {
              console.log('Successfully synced DUPR clubs');
            }
          } catch (error) {
            console.error('Error syncing clubs:', error);
          }
        }
      };
  
      syncClubsIfNeeded();
    }, [user, profileData?.dupr_id]);
  
    const loadProfileData = async () => {
      if (!user) return;
  
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
  
      if (data) {
        setProfileData(data);
        setDuprConnected(!!data.dupr_id);
        setDisplayName(data.display_name || '');
      }
    };
  
    const loadUpcomingTournaments = async () => {
      if (!user) return;
  
      try {
        const today = new Date();
  
        // First get tournaments where user is a participant
        const { data: userTeams } = await supabase
          .from('tournament_teams')
          .select('tournament_id')
          .or(`player1_user_id.eq.${user.id},player2_user_id.eq.${user.id}`);
  
        if (!userTeams || userTeams.length === 0) {
          setUpcomingTournaments([]);
          return;
        }
  
        const tournamentIds = userTeams.map(t => t.tournament_id);
  
        const { data: tournaments } = await supabase
          .from('tournaments')
          .select('*')
          .in('id', tournamentIds)
          .gte('date', today.toISOString().split('T')[0])
          .order('date', { ascending: true })
          .limit(3);
  
        // Get team counts for each tournament
        if (tournaments) {
          const tournamentsWithCounts = await Promise.all(
            tournaments.map(async (tournament) => {
              const { count } = await supabase
                .from('tournament_teams')
                .select('*', { count: 'exact', head: true })
                .eq('tournament_id', tournament.id);
  
              return { ...tournament, teamCount: count || 0 };
            })
          );
          setUpcomingTournaments(tournamentsWithCounts);
        } else {
          setUpcomingTournaments([]);
        }
      } catch (error) {
        console.error('Error loading tournaments:', error);
      }
    };
  
    const loadGameStats = async () => {
      if (!user) return;
  
      try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
  
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
        const { data: pickupMatches } = await supabase
          .from('pickup_matchups')
          .select('created_at')
          .eq('status', 'completed')
          .or(`player_a_user_id.eq.${user.id},player_b_user_id.eq.${user.id},team1_player1_user_id.eq.${user.id},team1_player2_user_id.eq.${user.id},team2_player1_user_id.eq.${user.id},team2_player2_user_id.eq.${user.id}`);
  
        const { data: scndDoubleTournamentMatches } = await supabase
          .from('tournament_matches')
          .select('created_at')
          .eq('status', 'completed')
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id},player3_id.eq.${user.id},player4_id.eq.${user.id}`);
        
        const allMatches = [
          ...(pickupMatches || []).map(m => ({ created_at: m.created_at })),
          ...(scndDoubleTournamentMatches || []).map(m => ({ created_at: m.created_at })),
        ];
  
        const total = allMatches.length;
        const thisWeek = allMatches.filter(m => new Date(m.created_at) >= startOfWeek).length;
        const thisMonth = allMatches.filter(m => new Date(m.created_at) >= startOfMonth).length;
        
        setGamesTotal(total);
        setGamesThisWeek(thisWeek);
        setGamesThisMonth(thisMonth);
      } catch (error) {
        console.error('Error loading game stats:', error);
      }
    };
  
    const handleSaveDisplayName = async () => {
      setSavingDisplayName(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: displayName.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user?.id);
  
        if (error) throw error;
  
        toast({
          title: 'Success',
          description: 'Display name updated',
        });
  
        setEditingDisplayName(false);
        await loadProfileData();
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setSavingDisplayName(false);
      }
    };
  
    const handleCancelEditDisplayName = () => {
      setDisplayName(profileData?.display_name || '');
      setEditingDisplayName(false);
    };
  
    const handleDisconnectDupr = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-unsubscribe-webhook`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to disconnect DUPR account');

        toast({
          title: 'Success',
          description: 'DUPR account disconnected',
        });

        setDuprConnected(false);
        await loadProfileData();
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
  
    const handleRefreshDuprStats = async () => {
      setRefreshing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }
  
        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-refresh-stats`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to refresh DUPR stats');
        }
  
        await loadProfileData();
  
        toast({
          title: 'Success',
          description: 'DUPR stats refreshed successfully',
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setRefreshing(false);
      }
    };
  
    const handleSignOut = async () => {
      await supabase.auth.signOut();
      router.push('/login');
    };

    const handleDeleteAccount = async () => {
      if (!user) return;
      setDeletingAccount(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ is_deleted: true })
          .eq('id', user.id);
        if (error) throw error;
        await supabase.auth.signOut();
        router.push('/login');
      } catch {
        toast({ title: 'Error', description: 'Failed to delete account. Please try again.', variant: 'destructive' });
        setDeletingAccount(false);
        setShowDeleteDialog(false);
      }
    };
  
    const displayNameValue = getDisplayName(
      { display_name: profileData?.display_name, full_name: profileData?.full_name, email: user?.email },
      'Player'
    );
  
    const initials = displayNameValue
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  
    return (
      <>
        {/* Mobile Layout */}
        <div className="md:hidden space-y-6 p-4 pb-20 bg-white">
  
          {/* Hero Section - Left Aligned */}
          <div className="space-y-4 pb-6">
            {/* Name at the top - Left aligned with Impact-style font */}
            <h1 className="text-5xl font-extrabold uppercase tracking-tighter text-left text-black leading-none" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              {displayNameValue}
            </h1>
  
            {/* Profile Photo and DUPR Rating */}
            <div className="flex items-start justify-start gap-6">
              <Avatar className="w-32 h-32 border-4 border-blue-400 shadow-lg">
                <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-blue-400 to-blue-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
  
              <div className="space-y-2 text-left mt-4">
                <div className="space-y-3">
                  <div className="text-sm font-bold text-[#84c225] uppercase tracking-wide">DUPR Rating</div>
                  <div className="text-2xl font-black text-black leading-none" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                    Singles : {profileData?.dupr_rating || profileData?.dupr_singles_rating  || 'N/A'}
        
                  </div>
                  <div className="text-2xl font-black text-black leading-none" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                     Doubles : { profileData?.dupr_doubles_rating  || 'N/A'} 
                  </div>
                  {/* <button className="text-sm text-[#84c225] underline flex items-center gap-1 mt-1 font-semibold">
                    <Edit className="h-3 w-3" />
                    EDIT DUPR ID
                  </button> */}
                  
                </div>
              </div>
            </div>
  
            {/* Location underneath - Left aligned, green with edit icon */}
           
  
            {/* DUPR Connection Management Buttons */}
            <div className="flex flex-col gap-2 pt-4">
              {duprConnected ? (
                <>
                  <Button
                    onClick={handleRefreshDuprStats}
                    disabled={refreshing}
                    variant="default"
                    className="w-full bg-black hover:bg-gray-800 text-white font-bold uppercase"
                  >
                    {refreshing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Refresh DUPR Stats
                  </Button>
                  <Button
                    onClick={handleDisconnectDupr}
                    disabled={loading}
                    variant="outline"
                    className="w-full font-bold uppercase"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="mr-2 h-4 w-4" />
                    )}
                    Disconnect DUPR
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => document.querySelector<HTMLElement>('[data-dupr-login-button]')?.click()}
                  variant="default"
                  className="w-full bg-black hover:bg-gray-800 text-white font-bold uppercase"
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Connect DUPR Account
                </Button>
              )}
            </div>
          </div>
  
          {/* Games Statistics */}
          <div className="border-t-2 border-b-2 border-black py-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs font-bold text-black uppercase tracking-wide mb-2 border-b-2 border-black pb-2" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                  Games This Week
                </div>
                <div className="text-5xl font-black text-[#84c225] leading-none" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                  {gamesThisWeek}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-black uppercase tracking-wide mb-2 border-b-2 border-black pb-2" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                  Games This Month
                </div>
                <div className="text-5xl font-black text-[#84c225] leading-none" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                  {gamesThisMonth}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-black uppercase tracking-wide mb-2 border-b-2 border-black pb-2" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                  Games Total
                </div>
                <div className="text-5xl font-black text-[#84c225] leading-none" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                  {gamesTotal}
                </div>
              </div>
            </div>
          </div>
  
          {/* Upcoming Tournaments */}
          {upcomingTournaments.length > 0 && (
            <div className="space-y-4">
              {upcomingTournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="border-2 border-black overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => router.push(`/dashboard/tournaments/${tournament.id}`)}
                >
                  {/* Green Header */}
                  <div className="bg-[#84c225] text-white p-4 flex items-center gap-3">
                    <Trophy className="w-8 h-8 flex-shrink-0" />
                    <div className="font-black text-lg uppercase tracking-wide" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                      {tournament.name}
                    </div>
                  </div>
  
                  {/* White Content Area */}
                  <div className="bg-white p-4 space-y-3">
                    <div className="text-sm font-bold text-gray-800 uppercase">
                      {tournament.teamCount || 0} PLAYERS JOINED
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-800 uppercase">
                      {tournament.date && tournament.start_time ? (
                        <span>
                          {format(new Date(`${tournament.date}T${tournament.start_time}`), 'h a')} | {format(new Date(tournament.date), 'EEEE, MMMM do').toUpperCase()}
                        </span>
                      ) : tournament.date ? (
                        format(new Date(tournament.date), 'EEEE, MMMM do').toUpperCase()
                      ) : (
                        'DATE TBD'
                      )}
                    </div>
                    <button className="text-[#84c225] font-bold text-sm uppercase tracking-wide hover:underline">
                      VIEW DETAILS &gt;
                    </button>
                  </div>
                </div>
              ))} 
            </div>
          )}
  
          {/* Display Name Editor */}
          <div className="space-y-3">
            <h3 className="text-2xl font-bold uppercase tracking-wide text-black" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>Display Settings</h3>
            <div className="p-4 border-2 border-gray-300 rounded-lg space-y-3 bg-white">
              <Label htmlFor="displayName-mobile" className="text-sm font-bold uppercase text-black">Display Name</Label>
              <div className="flex gap-2">
                <Input
                  id="displayName-mobile"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!editingDisplayName || savingDisplayName}
                  placeholder="Your display name"
                  maxLength={50}
                  className="flex-1 border-2"
                />
                {!editingDisplayName ? (
                  <Button
                    onClick={() => setEditingDisplayName(true)}
                    variant="outline"
                    size="icon"
                    className="border-2"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSaveDisplayName}
                      disabled={savingDisplayName}
                      size="icon"
                      className="bg-[#84c225] hover:bg-[#6fa51c]"
                    >
                      {savingDisplayName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      onClick={handleCancelEditDisplayName}
                      disabled={savingDisplayName}
                      variant="outline"
                      size="icon"
                      className="border-2"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-600 font-medium">
                {profileData?.display_name
                  ? 'Using your custom display name'
                  : profileData?.full_name
                    ? 'Using your DUPR name (set a custom display name to override)'
                    : 'Using your email prefix (set a display name to customize)'}
              </p>
            </div>
          </div>
  
          {/* DUPR Connection Card */}
          {!duprConnected && (
            <div className="space-y-3">
              <h3 className="text-2xl font-bold uppercase tracking-wide text-black" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>Connect DUPR Account</h3>
              <div className="p-4 border-2 border-gray-300 rounded-lg space-y-3 bg-white">
                <p className="text-sm text-gray-700 font-medium">
                  Sign in with your DUPR account to link your profile and access your ratings.
                </p>
                <DUPRLoginButton />
              </div>
            </div>
          )}
  
          {/* Account Settings Section */}
          <div className="space-y-3 pb-6">
            <h3 className="text-2xl font-bold uppercase tracking-wide text-black flex items-center gap-2" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              <User className="h-6 w-6" />
              Account Settings
            </h3>
            <div className="p-4 border-2 border-gray-300 rounded-lg space-y-3 bg-white">
              <p className="text-sm text-gray-700 font-medium">
                Manage your account and session preferences
              </p>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full font-bold uppercase border-2"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
              <Button
                onClick={() => setShowDeleteDialog(true)}
                variant="outline"
                className="w-full font-bold uppercase border-2 border-red-500 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
          </div>
        </div>
  
        {/* Desktop Layout - Keep existing */}
        <div className="hidden md:block space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Manage your display name and connect your DUPR account</p>
          </div>
  
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Display Settings
            </CardTitle>
            <CardDescription>
              Control how your name appears in matches and tournaments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <div className="flex gap-2">
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!editingDisplayName || savingDisplayName}
                  placeholder="Your display name"
                  maxLength={50}
                  className="flex-1"
                />
                {!editingDisplayName ? (
                  <Button
                    onClick={() => setEditingDisplayName(true)}
                    variant="outline"
                    size="icon"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSaveDisplayName}
                      disabled={savingDisplayName}
                      size="icon"
                    >
                      {savingDisplayName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      onClick={handleCancelEditDisplayName}
                      disabled={savingDisplayName}
                      variant="outline"
                      size="icon"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Current display: <span className="font-semibold">{getDisplayName({ display_name: profileData?.display_name, full_name: profileData?.full_name, email: user?.email }, 'Player')}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {profileData?.display_name
                  ? 'Using your custom display name'
                  : profileData?.full_name
                    ? 'Using your DUPR name (set a custom display name to override)'
                    : 'Using your email prefix (set a display name to customize)'}
              </p>
            </div>
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {duprConnected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  DUPR Profile Linked
                </>
              ) : (
                <>
                  <LinkIcon className="h-5 w-5" />
                  Connect Your DUPR Account
                </>
              )}
            </CardTitle>
            <CardDescription>
              {duprConnected
                ? 'Keep your profile current by refreshing your DUPR stats regularly, especially after playing new matches.'
                : 'Sign in with your DUPR account to link your profile and access your ratings.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {duprConnected && (
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Keep your rating current!</strong> Refresh your DUPR stats after each login or after playing new matches to ensure accurate ratings.
                </AlertDescription>
              </Alert>
            )}
  
            {duprConnected && profileData ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-lg">{profileData.full_name || 'DUPR User'}</div>
                      <div className="text-xs text-muted-foreground">DUPR ID: {profileData.dupr_id}</div>
                    </div>
                  </div>
  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-4 border rounded-lg bg-background">
                      <div className="text-sm text-muted-foreground mb-1">Singles</div>
                      <div className="text-2xl font-bold">
                        {profileData.dupr_singles_rating || 'N/A'}
                      </div>
                    </div>
  
                    <div className="p-4 border rounded-lg bg-background">
                      <div className="text-sm text-muted-foreground mb-1">Doubles</div>
                      <div className="text-2xl font-bold">
                        {profileData.dupr_doubles_rating || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
  
            {duprConnected ? (
              <div className="space-y-3">
                <Button
                  onClick={handleRefreshDuprStats}
                  disabled={refreshing}
                  size="lg"
                  className="w-full"
                >
                  {refreshing ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-5 w-5" />
                  )}
                  Refresh My DUPR Rating
                </Button>
                <Button
                  onClick={handleDisconnectDupr}
                  disabled={loading}
                  variant="outline"
                  className="w-full text-muted-foreground"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect DUPR Account
                </Button>
              </div>
            ) : (
              <DUPRLoginButton />
            )}
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>DinkHead History</CardTitle>
            <CardDescription>Your wins, losses, and point differentials from all games played in this app</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const [pickupHistory, setPickupHistory] = useState<any[]>([]);
              const [singlesHistory, setSinglesHistory] = useState<any[]>([]);
              const [tournamentHistory, setTournamentHistory] = useState<any[]>([]);
              const [historyLoading, setHistoryLoading] = useState(true);

              useEffect(() => {
                const loadHistory = async () => {
                  if (!user) return;

                  try {
                    const { data: pickupMatches } = await supabase
                      .from('pickup_matchups')
                      .select(`
                        *,
                        pickup_sessions!inner(name, format)
                      `)
                      .eq('status', 'completed')
                      .or(`player_a_user_id.eq.${user.id},player_b_user_id.eq.${user.id},team1_player1_user_id.eq.${user.id},team1_player2_user_id.eq.${user.id},team2_player1_user_id.eq.${user.id},team2_player2_user_id.eq.${user.id}`)
                      .order('created_at', { ascending: false })
                      .limit(10);

                    const { data: singlesMatches } = await supabase
                      .from('tournament_matches')
                      .select(`
                        *,
                        tournaments!inner(name, format)
                      `)
                      .eq('status', 'completed')
                      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
                      .order('created_at', { ascending: false })
                      .limit(10);

                    const { data: allDoublesMatches } = await supabase
                      .from('tournament_matches')
                      .select(`
                        *,
                        tournaments!inner(name, format),
                        team1:tournament_teams!tournament_matches_team1_id_fkey(
                          id,
                          player1_user_id,
                          player2_user_id
                        ),
                        team2:tournament_teams!tournament_matches_team2_id_fkey(
                          id,
                          player1_user_id,
                          player2_user_id
                        )
                      `)
                      .eq('status', 'completed')
                      .not('team1_id', 'is', null)
                      .order('created_at', { ascending: false });

                    const doublesMatches = (allDoublesMatches || [])
                      .filter((m: any) =>
                        m.team1?.player1_user_id === user.id ||
                        m.team1?.player2_user_id === user.id ||
                        m.team2?.player1_user_id === user.id ||
                        m.team2?.player2_user_id === user.id
                      )
                      .slice(0, 10);

                    setPickupHistory(pickupMatches || []);
                    setSinglesHistory(singlesMatches || []);
                    setTournamentHistory(doublesMatches || []);
                  } catch (error) {
                    console.error('Error loading history:', error);
                  } finally {
                    setHistoryLoading(false);
                  }
                };

                loadHistory();
              }, [user]);
  
              if (historyLoading) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading history...
                  </div>
                );
              }
  
              const totalMatches = pickupHistory.length + singlesHistory.length + tournamentHistory.length;
  
              if (totalMatches === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    No match history yet. Play some games to see your history here!
                  </div>
                );
              }
  
              let wins = 0;
              let losses = 0;
              let pointsFor = 0;
              let pointsAgainst = 0;
  
              pickupHistory.forEach((match: any) => {
                const isTeam1 = match.player_a_user_id === user?.id ||
                               match.team1_player1_user_id === user?.id ||
                               match.team1_player2_user_id === user?.id;
                const isTeam2 = match.player_b_user_id === user?.id ||
                               match.team2_player1_user_id === user?.id ||
                               match.team2_player2_user_id === user?.id;
  
                if (!isTeam1 && !isTeam2) return;
  
                const won = (isTeam1 && match.winner_side === 'team1') ||
                           (isTeam2 && match.winner_side === 'team2');
  
                if (won) wins++;
                else losses++;
  
                const bestOf = match.best_of || 3;
                for (let i = 1; i <= bestOf; i++) {
                  const t1Points = match[`game${i}_team1_points`];
                  const t2Points = match[`game${i}_team2_points`];
  
                  if (t1Points !== null && t2Points !== null) {
                    if (isTeam1) {
                      pointsFor += t1Points;
                      pointsAgainst += t2Points;
                    } else if (isTeam2) {
                      pointsFor += t2Points;
                      pointsAgainst += t1Points;
                    }
                  }
                }
              });
  
              tournamentHistory.forEach((match: any) => {
                const isTeam1 = match.team1?.player1_user_id === user?.id ||
                               match.team1?.player2_user_id === user?.id;
                const isTeam2 = match.team2?.player1_user_id === user?.id ||
                               match.team2?.player2_user_id === user?.id;

                if (!isTeam1 && !isTeam2) return;

                const won = (isTeam1 && match.winner_team_id === match.team1_id) ||
                           (isTeam2 && match.winner_team_id === match.team2_id);

                if (won) wins++;
                else losses++;

                if (isTeam1) {
                  pointsFor += match.team1_score || 0;
                  pointsAgainst += match.team2_score || 0;
                } else if (isTeam2) {
                  pointsFor += match.team2_score || 0;
                  pointsAgainst += match.team1_score || 0;
                }
              });

              singlesHistory.forEach((match: any) => {
                const isPlayer1 = match.player1_id === user?.id;
                const isPlayer2 = match.player2_id === user?.id;

                if (!isPlayer1 && !isPlayer2) return;

                const won = (isPlayer1 && match.winner_team_id === match.player1_id) ||
                           (isPlayer2 && match.winner_team_id === match.player2_id) ||
                           (isPlayer1 && match.team1_score > match.team2_score) ||
                           (isPlayer2 && match.team2_score > match.team1_score);

                if (won) wins++;
                else losses++;

                if (isPlayer1) {
                  pointsFor += match.team1_score || 0;
                  pointsAgainst += match.team2_score || 0;
                } else if (isPlayer2) {
                  pointsFor += match.team2_score || 0;
                  pointsAgainst += match.team1_score || 0;
                }
              });
  
              const pointDifferential = pointsFor - pointsAgainst;
  
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{totalMatches}</div>
                      <div className="text-xs text-muted-foreground">Total Matches</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{wins}</div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{losses}</div>
                      <div className="text-xs text-muted-foreground">Losses</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className={`text-2xl font-bold ${pointDifferential >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pointDifferential >= 0 ? '+' : ''}{pointDifferential}
                      </div>
                      <div className="text-xs text-muted-foreground">Point Differential</div>
                    </div>
                  </div>
  
                  {pickupHistory.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Recent Pickup Matches</h4>
                      <div className="space-y-2">
                        {pickupHistory.slice(0, 5).map((match: any) => (
                          <div key={match.id} className="p-3 border rounded-lg text-sm">
                            <div className="font-medium">{match.pickup_sessions.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {match.pickup_sessions.format === 'singles' ? 'Singles' : 'Doubles'} • Best of 3
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {singlesHistory.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Recent Singles Tournament Matches</h4>
                      <div className="space-y-2">
                        {singlesHistory.slice(0, 5).map((match: any) => {
                          const isPlayer1 = match.player1_id === user?.id;
                          const isPlayer2 = match.player2_id === user?.id;
                          const won = (isPlayer1 && (match.winner_team_id === match.player1_id || match.team1_score > match.team2_score)) ||
                                     (isPlayer2 && (match.winner_team_id === match.player2_id || match.team2_score > match.team1_score));
                          return (
                            <div key={match.id} className="p-3 border rounded-lg text-sm flex items-center justify-between">
                              <div>
                                <div className="font-medium">{match.tournaments?.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Singles • {match.team1_score ?? '-'} – {match.team2_score ?? '-'}
                                </div>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {won ? 'W' : 'L'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {tournamentHistory.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Recent Doubles Tournament Matches</h4>
                      <div className="space-y-2">
                        {tournamentHistory.slice(0, 5).map((match: any) => {
                          const isTeam1 = match.team1?.player1_user_id === user?.id || match.team1?.player2_user_id === user?.id;
                          const isTeam2 = match.team2?.player1_user_id === user?.id || match.team2?.player2_user_id === user?.id;
                          const won = (isTeam1 && match.winner_team_id === match.team1_id) ||
                                     (isTeam2 && match.winner_team_id === match.team2_id);
                          return (
                            <div key={match.id} className="p-3 border rounded-lg text-sm flex items-center justify-between">
                              <div>
                                <div className="font-medium">{match.tournaments?.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Doubles • {match.team1_score ?? '-'} – {match.team2_score ?? '-'}
                                </div>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {won ? 'W' : 'L'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Manage your account and session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="outline"
              className="w-full border-red-500 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete your account? This action cannot be undone. You will be signed out immediately and will not be able to log back in.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deletingAccount}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
                ) : (
                  <><Trash2 className="mr-2 h-4 w-4" />Delete Account</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </>
    );
  }
