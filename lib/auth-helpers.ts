import { supabase } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SessionValidationResult {
  isValid: boolean;
  userId: string | null;
  error: string | null;
}

export async function validateSession(): Promise<SessionValidationResult> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session || !session.user) {
      return {
        isValid: false,
        userId: null,
        error: 'Please log in to continue.'
      };
    }

    return {
      isValid: true,
      userId: session.user.id,
      error: null
    };
  } catch (err: any) {
    console.error('Session validation error:', err);
    return {
      isValid: false,
      userId: null,
      error: 'Authentication error. Please log in again.'
    };
  }
}

export async function getAuthenticatedSupabaseClient(): Promise<SupabaseClient> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session for authenticated client:', error);
    throw new Error('Session error. Please log in again.');
  }

  if (!session || !session.user) {
    throw new Error('Please log in to continue.');
  }

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  console.log('Authenticated client ready with JWT token for user:', session.user.id);
  console.log('Token expires at:', new Date(session.expires_at! * 1000).toISOString());

  return supabase;
}

export async function ensureAuthenticated(): Promise<{ userId: string }> {
  const validation = await validateSession();

  if (!validation.isValid || !validation.userId) {
    throw new Error(validation.error || 'Authentication required');
  }

  return { userId: validation.userId };
}

export interface AuthReadyResult {
  success: boolean;
  userId: string | null;
  error: string | null;
  profileExists: boolean;
  client: SupabaseClient | null;
}

export async function ensureAuthReady(): Promise<AuthReadyResult> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      return {
        success: false,
        userId: null,
        error: 'Session error. Please log in again.',
        profileExists: false,
        client: null
      };
    }

    if (!session || !session.user) {
      return {
        success: false,
        userId: null,
        error: 'No active session. Please log in.',
        profileExists: false,
        client: null
      };
    }

    const userId = session.user.id;

    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    console.log('JWT token synchronized for user:', userId);
    console.log('Token expires at:', new Date(session.expires_at! * 1000).toISOString());

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Profile check error:', profileError);
      return {
        success: false,
        userId,
        error: 'Error checking profile. Please try again.',
        profileExists: false,
        client: null
      };
    }

    if (!profile) {
      return {
        success: false,
        userId,
        error: 'Profile not found. Please contact support.',
        profileExists: false,
        client: null
      };
    }

    return {
      success: true,
      userId,
      error: null,
      profileExists: true,
      client: supabase
    };
  } catch (err: any) {
    console.error('Auth ready check failed:', err);
    return {
      success: false,
      userId: null,
      error: 'Authentication check failed. Please try again.',
      profileExists: false,
      client: null
    };
  }
}
