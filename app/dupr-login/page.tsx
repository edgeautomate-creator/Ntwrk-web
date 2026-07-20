'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader as Loader2, ArrowLeft, CircleCheck as CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DUPRLoginPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState('');

  const duprEnv = process.env.NEXT_PUBLIC_DUPR_ENV || 'uat';
  console.log( process.env.NEXT_PUBLIC_DUPR_CLIENT_KEY)
  const clientKey = process.env.NEXT_PUBLIC_DUPR_CLIENT_KEY || 'test-ck-0a9d3935-1a00-46be-fbf9-6376d4af637c';
  console.log(clientKey)
  const clientKeyBase64 = typeof window !== 'undefined'
    ? btoa(clientKey)
    : 'dGVzdC1jay0wYTlkMzkzNS0xYTAwLTQ2YmUtZmJmOS02Mzc2ZDRhZjYzN2M=';
  console.log(clientKeyBase64)
  const duprBaseUrl = duprEnv === 'production'
    ? 'https://dashboard.dupr.com'
    : 'https://uat.dupr.gg';

  const duprLoginUrl = `${duprBaseUrl}/login-external-app/${clientKeyBase64}`;

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== duprBaseUrl) {
        console.log('⚠️ Ignoring message from:', event.origin);
        return;
      }
  
      console.log('📩 Received postMessage from DUPR:', event.data);

      if (event.data.userToken) {
        setIsProcessing(true);
        setMessage('Saving your DUPR account...');

        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();

          if (!session?.user) {
            throw new Error('No authenticated user found. Please log in first.');
          }

          const duprId = event.data.duprId || event.data.id;
          const duprUserId = event.data.id ?? event.data.user_id;

          const updateData: any = {
            dupr_user_token: event.data.userToken,
            updated_at: new Date().toISOString(),
          };

          if (duprId) updateData.dupr_id = duprId;
          if (duprUserId != null) updateData.dupr_user_id = String(duprUserId);
          if (event.data.refreshToken) updateData.dupr_refresh_token = event.data.refreshToken;
          if (event.data.fullName || event.data.email) updateData.full_name = event.data.fullName || event.data.email;
          if (event.data.stats?.singles) updateData.dupr_singles_rating = event.data.stats.singles === 'NR' ? null : event.data.stats.singles;
          if (event.data.stats?.doubles) updateData.dupr_doubles_rating = event.data.stats.doubles === 'NR' ? null : event.data.stats.doubles;

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
                  userToken: event.data.userToken,
                  refreshToken: event.data.refreshToken,
                  fullName: event.data.fullName,
                  email: event.data.email,
                  stats: event.data.stats,
                  subscriptions: event.data.subscriptions,
                },
              }),
            });
            const webhookJson = await webhookRes.json();
            console.log('✅ Webhook response:', webhookJson);
            if (!webhookRes.ok) throw new Error(webhookJson.error ?? 'Webhook failed');
          } catch (webhookErr) {
            // Fallback: write directly so the user is never blocked
            console.warn('⚠️ Webhook call failed, falling back to direct write:', webhookErr);
            const { error } = await supabase
              .from('profiles')
              .update(updateData)
              .eq('id', session.user.id);
            if (error) {
              console.error('❌ Database error:', error);
              throw error;
            }
          }

          console.log('✅ DUPR account linked successfully!');
          setMessage('Your DUPR account has been linked successfully!');
          setIsSuccess(true);
          setIsProcessing(false);

        } catch (err) {
          console.error('❌ Error saving DUPR data:', err);
          setMessage(err instanceof Error ? err.message : 'Failed to link DUPR account');
          setIsProcessing(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [duprBaseUrl, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold mb-2">Connect with DUPR</h1>
          <p className="text-gray-600">
            Log in with your DUPR account to link your ratings and match history.
          </p>
        </div>

        {isProcessing && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-gray-900 font-medium">{message}</span>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-900">DUPR Account Linked!</p>
                <p className="text-sm text-green-700">{message}</p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/dashboard/profile')}
              className="bg-green-600 hover:bg-green-700 text-white ml-4 flex-shrink-0"
            >
              Go to Profile
            </Button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <iframe
            src={duprLoginUrl}
            className="w-full h-[700px] border-0"
            title="DUPR Login"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}
