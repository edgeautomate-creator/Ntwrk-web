'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { checkAndSyncDuprClubs } from '../dupr-club-sync';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  refreshSession: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Error refreshing session:', error);
        setUser(null);
        setSession(null);
        return;
      }

      if (refreshedSession) {
        setUser(refreshedSession.user);
        setSession(refreshedSession);
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let refreshTimer: NodeJS.Timeout | null = null;

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('Error getting initial session:', error);
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }

        if (currentSession) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_deleted')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (profile?.is_deleted) {
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setLoading(false);
            return;
          }

          setUser(currentSession.user);
          setSession(currentSession);

          const expiresAt = currentSession.expires_at;
          if (expiresAt) {
            const expiresIn = expiresAt * 1000 - Date.now();
            const refreshTime = Math.max(expiresIn - 60 * 60 * 1000, 60000);

            refreshTimer = setTimeout(() => {
              if (mounted) {
                refreshSession();
              }
            }, refreshTime);
          }
        } else {
          setUser(null);
          setSession(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
        setSession(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
      } else if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'INITIAL_SESSION' ||
        event === 'USER_UPDATED'
      ) {
        if (newSession) {
          setUser(newSession.user);
          setSession(newSession);

          if (event === 'SIGNED_IN') {
            checkAndSyncDuprClubs(newSession.user.id, newSession.access_token).catch(err => {
              console.error('Background club sync failed:', err);
            });
          }

          const expiresAt = newSession.expires_at;
          if (expiresAt) {
            const expiresIn = expiresAt * 1000 - Date.now();
            const refreshTime = Math.max(expiresIn - 60 * 60 * 1000, 60000);

            refreshTimer = setTimeout(() => {
              if (mounted) {
                refreshSession();
              }
            }, refreshTime);
          }
        } else if (event === 'INITIAL_SESSION') {
          // No stored session on refresh — truly logged out
          setUser(null);
          setSession(null);
        }
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  return (
    <AuthContext.Provider value={{ user, session, loading, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
