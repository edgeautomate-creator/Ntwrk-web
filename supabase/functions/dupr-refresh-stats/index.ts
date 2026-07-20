import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
async function getDuprToken(clientKey: string, clientSecret: string) {
  if (!clientKey || !clientSecret) {
    throw new Error('DUPR_CLIENT_KEY and DUPR_CLIENT_SECRET must be configured');
  }
  console.log("ENV:", Deno.env.get("ENVIRONMENT"))
  const authString = btoa(`${clientKey}:${clientSecret}`);
  console.log('Attempting DUPR authentication...');
  try {
    const duprResponse = await fetch('https://prod.mydupr.com/api/auth/v1.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': `${authString}`,
      }
    });
    const contentType = duprResponse.headers.get('content-type');
    console.log('DUPR auth response status:', duprResponse.status, 'content-type:', contentType);
    let duprResult;
    if (contentType && contentType.includes('application/json')) {
      duprResult = await duprResponse.json();
      console.log('DUPR auth JSON response:', duprResult);
    } else {
      const textResponse = await duprResponse.text();
      console.error('DUPR auth returned non-JSON response:', textResponse);
      throw new Error(`DUPR authentication failed with non-JSON response: ${textResponse.substring(0, 100)}`);
    }
    if (!duprResponse.ok) {
      throw new Error(duprResult.message || `DUPR authentication failed with status ${duprResponse.status}`);
    }
    if (!duprResult.result?.token) {
      throw new Error('Invalid response from DUPR: missing token');
    }
    console.log('DUPR authentication successful');
    return duprResult.result.token;
  } catch (error) {
    console.error('Error during DUPR authentication:', error);
    throw error;
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
    const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token', details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('dupr_id, full_name')
      .eq('id', user.id)
      .maybeSingle();
    console.log('Profile query result:', { profile, profileError, userId: user.id });
    if (!profile?.dupr_id) {
      return new Response(
        JSON.stringify({ error: 'No DUPR account linked' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    const duprToken = await getDuprToken(clientKey, clientSecret);
    const userInfoResponse = await fetch(`https://prod.mydupr.com/api/user/v1.0/${profile.dupr_id}`, {
      headers: {
        'Authorization': `Bearer ${duprToken}`,
      },
    });
    if (!userInfoResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch DUPR data. Your token may have expired.' }),
        {
          status: userInfoResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    const userInfo = await userInfoResponse.json();
    const userData = userInfo.result;
    let fullName = 'DUPR User';
    if (userData.fullName) {
      fullName = userData.fullName;
    } else if (userData.firstName && userData.lastName) {
      fullName = `${userData.firstName} ${userData.lastName}`;
    } else if (userData.firstName) {
      fullName = userData.firstName;
    } else if (userData.email) {
      fullName = userData.email;
    }
    const updateData = {
      full_name: fullName,
      dupr_singles_rating: userData.ratings?.singles || null,
      dupr_doubles_rating: userData.ratings?.doubles || null,
      dupr_singles_wins: userData?.performance?.singles?.win || 0,
      dupr_singles_losses: userData?.performance?.singles?.loss || 0,
      dupr_doubles_wins: userData?.performance?.doubles?.win || 0,
      dupr_doubles_losses: userData?.performance?.doubles?.loss || 0,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);
    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          singles: updateData.dupr_singles_rating,
          doubles: updateData.dupr_doubles_rating,
          singlesWins: updateData.dupr_singles_wins,
          singlesLosses: updateData.dupr_singles_losses,
          doublesWins: updateData.dupr_doubles_wins,
          doublesLosses: updateData.dupr_doubles_losses,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error refreshing DUPR stats:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to refresh stats',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
