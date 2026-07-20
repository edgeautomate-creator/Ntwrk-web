import { createClient } from '@/lib/supabase/client';

export interface DuprSubscriptionCache {
  dupr_id: string;
  tournaments: string[];
  merchandise: string[];
  display_name: string | null;
  status: string | null;
  cached_at: string;
  expires_at: string;
}

export async function getDuprSubscriptionByDuprId(
  duprId: string
): Promise<DuprSubscriptionCache | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('dupr_subscriptions_cache')
    .select('*')
    .eq('dupr_id', duprId)
    .maybeSingle();

  if (error || !data) return null;

  const now = new Date();
  const expiresAt = new Date(data.expires_at);
  if (now > expiresAt) return null;

  return data as DuprSubscriptionCache;
}

export async function getCurrentUserDuprSubscription(): Promise<DuprSubscriptionCache | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('dupr_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.dupr_id) return null;

  return getDuprSubscriptionByDuprId(profile.dupr_id);
}

export async function refreshDuprSubscription(sessionToken: string): Promise<boolean> {
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-refresh-subscriptions`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to refresh DUPR subscriptions:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error refreshing DUPR subscriptions:', error);
    return false;
  }
}

export function hasTournamentEntitlement(
  subscription: DuprSubscriptionCache | null,
  entitlement: string
): boolean {
  if (!subscription) return false;
  return subscription.tournaments.includes(entitlement);
}
