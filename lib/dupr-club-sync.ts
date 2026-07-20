import { supabase } from './supabase/client';

export async function syncDuprClubs(sessionToken: string): Promise<boolean> {
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-user-clubs`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to sync DUPR clubs:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('Successfully synced DUPR clubs:', data);
    return true;
  } catch (error) {
    console.error('Error syncing DUPR clubs:', error);
    return false;
  }
}

export async function deleteUserDuprClubs(duprId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_dupr_clubs')
      .delete()
      .eq('dupr_id', duprId);

    if (error) {
      console.error('Error deleting DUPR clubs:', error);
      return false;
    }

    console.log('Successfully deleted DUPR clubs for DUPR ID:', duprId);
    return true;
  } catch (error) {
    console.error('Error deleting DUPR clubs:', error);
    return false;
  }
}

export async function checkAndSyncDuprClubs(userId: string, sessionToken: string): Promise<void> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('dupr_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking profile for DUPR ID:', error);
      return;
    }

    if (profile?.dupr_id) {
      console.log('User has DUPR ID, syncing clubs...');
      await syncDuprClubs(sessionToken);
    }
  } catch (error) {
    console.error('Error in checkAndSyncDuprClubs:', error);
  }
}
