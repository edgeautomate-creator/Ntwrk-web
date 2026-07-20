'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Loader as Loader2 } from 'lucide-react';
import { syncDuprClubs } from '@/lib/dupr-club-sync';
import { Button } from '@/components/ui/button';

export default function DUPRCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing DUPR authentication...');

  useEffect(() => {
    console.log('🔍 DUPR Callback page loaded');
    console.log('🔍 Search params:', searchParams.toString());
    console.log('🔍 Full URL:', window.location.href);

    const processCallback = async () => {
      try {
        const handleMessage = (event: MessageEvent) => {
          console.log('📨 Callback received postMessage from:', event.origin);
          console.log('📨 Message data:', JSON.stringify(event.data, null, 2));

          if (event.origin !== 'https://uat.dupr.gg' &&
              event.origin !== 'https://dupr.gg' &&
              event.origin !== 'https://dashboard.dupr.com') {
            console.log('⚠️ Ignoring message from untrusted origin');
            return;
          }

          const data = event.data;

          if (!data?.userToken) {
            console.log('⚠️ Message missing userToken');
            return;
          }

          console.log('✅ Received valid DUPR auth data via postMessage');
          saveAuthData(data);
        };

        window.addEventListener('message', handleMessage);

        const urlData: any = {};
        searchParams.forEach((value, key) => {
          urlData[key] = value;
        });

        if (Object.keys(urlData).length > 0) {
          console.log('📨 Found URL parameters:', urlData);

          if (urlData.userToken || urlData.access_token) {
            console.log('✅ Found auth data in URL parameters');
            const authData = {
              userToken: urlData.userToken || urlData.access_token,
              refreshToken: urlData.refreshToken || urlData.refresh_token,
              id: urlData.id || urlData.user_id,
              duprId: urlData.duprId || urlData.dupr_id,
              email: urlData.email,
              fullName: urlData.fullName || urlData.full_name,
              stats: urlData.stats ? JSON.parse(urlData.stats) : undefined,
            };

            await saveAuthData(authData);
            return;
          }
        }

        console.log('⏳ Waiting for DUPR postMessage...');
        setTimeout(() => {
          if (status === 'processing') {
            console.log('⏰ Timeout waiting for DUPR data');
            setStatus('error');
            setMessage('No authentication data received. Please try again.');
          }
        }, 30000);

      } catch (error) {
        console.error('❌ Error processing callback:', error);
        setStatus('error');
        setMessage('Error processing authentication');
      }
    };

    const saveAuthData = async (data: any) => {
      console.log('💾 Saving DUPR auth data:', data);
      setMessage('Saving your DUPR account...');

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('No authenticated user found. Please log in first.');
        }

        console.log('💾 Saving DUPR data for user:', session.user.id);

        const duprId = data.duprId || data.dupr_id;
        const duprUserId = data.id ?? data.user_id;

        const updateData: any = {
          dupr_user_token: data.userToken,
          updated_at: new Date().toISOString(),
        };

        if (duprId) updateData.dupr_id = duprId;
        if (duprUserId != null) updateData.dupr_user_id = String(duprUserId);
        if (data.refreshToken) updateData.dupr_refresh_token = data.refreshToken;
        if (data.fullName || data.email) updateData.full_name = data.fullName || data.email;
        if (data.stats?.singles !== undefined) updateData.dupr_singles_rating = data.stats.singles;
        if (data.stats?.doubles !== undefined) updateData.dupr_doubles_rating = data.stats.doubles;
        if (data.stats?.singlesWins !== undefined) updateData.dupr_singles_wins = data.stats.singlesWins;
        if (data.stats?.singlesLosses !== undefined) updateData.dupr_singles_losses = data.stats.singlesLosses;
        if (data.stats?.doublesWins !== undefined) updateData.dupr_doubles_wins = data.stats.doublesWins;
        if (data.stats?.doublesLosses !== undefined) updateData.dupr_doubles_losses = data.stats.doublesLosses;

        console.log('💾 Update data:', updateData);

        // Route through webhook — handles profile update + subscription cache
        const webhookUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-webhook`;
        try {
          const webhookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventType: 'LOGIN',
              data: {
                id: session.user.id,
                duprId,
                duprUserId,
                userToken: data.userToken,
                refreshToken: data.refreshToken,
                fullName: data.fullName,
                email: data.email,
                stats: data.stats,
                subscriptions: data.subscriptions,
              },
            }),
          });
          const webhookJson = await webhookRes.json();
          console.log('✅ Webhook response:', webhookJson);
          if (!webhookRes.ok) throw new Error(webhookJson.error ?? 'Webhook failed');
        } catch (webhookErr) {
          // Fallback: write directly so the user is never blocked
          console.warn('⚠️ Webhook call failed, falling back to direct write:', webhookErr);
          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', session.user.id);
          if (updateError) {
            console.error('❌ Database error:', updateError);
            throw updateError;
          }
        }

        console.log('✅ DUPR account linked successfully!');

        setMessage('Fetching latest stats from DUPR...');

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dupr-refresh-stats`;
            const refreshResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            });

            if (refreshResponse.ok) {
              console.log('✅ Stats refreshed successfully');
            } else {
              console.log('⚠️ Stats refresh failed, but continuing anyway');
            }

            setMessage('Syncing your DUPR clubs...');
            const clubsSynced = await syncDuprClubs(session.access_token);
            if (clubsSynced) {
              console.log('✅ Clubs synced successfully');
            } else {
              console.log('⚠️ Club sync failed, but continuing anyway');
            }
          }
        } catch (refreshError) {
          console.log('⚠️ Error refreshing stats:', refreshError);
        }

        setStatus('success');
        setMessage('Your DUPR account has been linked successfully!');

      } catch (err) {
        console.error('❌ Error saving DUPR data:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to link DUPR account');
      }
    };

    processCallback();
  }, [router, searchParams, status]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-xl font-semibold mb-2">Processing...</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-green-900">DUPR Account Linked!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <Button
              onClick={() => router.push('/dashboard/profile')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Go to Profile
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-red-900">Error</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <Button
              onClick={() => router.push('/dashboard/profile')}
              variant="outline"
              className="w-full"
            >
              Go to Profile
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
