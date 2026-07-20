import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function refreshDuprToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
    const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');

    if (!clientKey || !clientSecret) {
      console.error('Missing DUPR client credentials');
      return null;
    }

    const authString = btoa(`${clientKey}:${clientSecret}`);

    console.log('Attempting to refresh DUPR token...');

    const response = await fetch('https://prod.mydupr.com/api/auth/v1.0/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': authString,
      },
      body: JSON.stringify({
        refreshToken: refreshToken,
      }),
    });

    const contentType = response.headers.get('content-type');
    console.log('DUPR refresh response status:', response.status, 'content-type:', contentType);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      return null;
    }

    let result;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const textResponse = await response.text();
      console.error('DUPR refresh returned non-JSON response:', textResponse);
      return null;
    }

    if (result.result?.token && result.result?.refreshToken) {
      console.log('Successfully refreshed DUPR token');
      return {
        accessToken: result.result.token,
        refreshToken: result.result.refreshToken,
      };
    }

    console.error('Invalid response structure from DUPR refresh endpoint');
    return null;
  } catch (error) {
    console.error('Error refreshing DUPR token:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('dupr_refresh_token, dupr_user_token')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.dupr_refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No DUPR refresh token found' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Refreshing DUPR token for user ${user.id}`);

    const newTokens = await refreshDuprToken(profile.dupr_refresh_token);

    if (!newTokens) {
      return new Response(
        JSON.stringify({ error: 'Failed to refresh DUPR token' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        dupr_user_token: newTokens.accessToken,
        dupr_refresh_token: newTokens.refreshToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating tokens in database:', updateError);
      throw updateError;
    }

    console.log('Successfully refreshed and saved new DUPR tokens');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token refreshed successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in dupr-refresh-token function:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to refresh token',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
