import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
    const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');
    const duprEnv = Deno.env.get('DUPR_ENV') || 'uat';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('dupr_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.dupr_id) {
      return new Response(
        JSON.stringify({ error: 'No DUPR account linked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clientKey || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'DUPR client credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authString = btoa(`${clientKey}:${clientSecret}`);
    const duprAuthResponse = await fetch('https://prod.mydupr.com/api/auth/v1.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': authString,
      },
    });

    if (!duprAuthResponse.ok) {
      const errText = await duprAuthResponse.text();
      console.error('DUPR client auth failed:', duprAuthResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with DUPR' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duprAuthData = await duprAuthResponse.json();
    const clientAccessToken = duprAuthData.result?.token;
    if (!clientAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid DUPR auth response: missing token' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subBaseUrl = 'https://api.dupr.gg';

    const subResponse = await fetch(`${subBaseUrl}/subscription/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${clientAccessToken}`,
      },
      body: new URLSearchParams({ dupr_id: profile.dupr_id }),
    });

    if (!subResponse.ok) {
      const errText = await subResponse.text();
      console.error('DUPR subscription API error:', subResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch DUPR subscriptions', status: subResponse.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subData = await subResponse.json();
    console.log('DUPR subscription raw response:', JSON.stringify(subData));
    const sub = subData?.subscriptions?.[0];

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const entitlements = sub?.entitlements ?? {};

    const upsertData = {
      dupr_id: profile.dupr_id,
      entitlements,
      tournaments: entitlements?.tournaments ?? [],
      merchandise: entitlements?.merchandise ?? [],
      display_name: sub?.displayName ?? null,
      status: sub?.status ?? null,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const { error: upsertError } = await serviceClient
      .from('dupr_subscriptions_cache')
      .upsert(upsertData, { onConflict: 'dupr_id' });

    if (upsertError) {
      console.error('Error upserting subscription cache:', upsertError);
      throw upsertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        dupr_id: profile.dupr_id,
        subscription: upsertData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error refreshing DUPR subscriptions:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to refresh subscriptions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
