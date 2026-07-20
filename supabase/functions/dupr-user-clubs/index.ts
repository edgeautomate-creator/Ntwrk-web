import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DuprClub {
  id: string;
  name: string;
  role?: string;
}

interface CachedClub {
  dupr_club_id: string;
  club_name: string;
  club_data: Record<string, unknown> | null;
  last_synced_at: string;
  user_role?: string;
}

function normalizeClubs(raw: unknown): DuprClub[] {
  if (!raw || typeof raw !== 'object') return [];
  const arr = Array.isArray(raw)
    ? raw
    : (raw as Record<string, unknown>).result != null
      ? (raw as Record<string, unknown>).result as unknown[]
      : (raw as Record<string, unknown>).clubs != null
        ? (raw as Record<string, unknown>).clubs as unknown[]
        : [];
  return arr
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => {
      const id = String(item.id ?? item.clubId ?? item.club_id ?? '');
      const name = String(item.name ?? item.clubName ?? item.club_name ?? 'Unknown');
      const role = String(item.role ?? item.userRole ?? item.user_role ?? item.membershipRole ?? '').toLowerCase();
      return { id, name, role: role || undefined };
    })
    .filter((c) => c.id);
}

function filterClubsByRole(clubs: DuprClub[]): DuprClub[] {
  const allowedRoles = ['director', 'organizer'];
  const filtered = clubs.filter(club => club.role && allowedRoles.includes(club.role.toLowerCase()));

  console.log(`Club role filtering: ${clubs.length} total clubs, ${filtered.length} with director/organizer role`);
  if (clubs.length > 0) {
    const roleDistribution = clubs.reduce((acc, club) => {
      const role = club.role || 'unknown';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Role distribution:', roleDistribution);
  }

  return filtered;
}

async function getCachedClubs(supabase: ReturnType<typeof createClient>, duprId: string): Promise<DuprClub[]> {
  console.log(`Fetching cached clubs for DUPR ID ${duprId}`);

  const { data: cachedClubs, error } = await supabase
    .from('user_dupr_clubs')
    .select('dupr_club_id, club_name, user_role, last_synced_at')
    .eq('dupr_id', duprId)
    .order('last_synced_at', { ascending: false });

  if (error) {
    console.error('Error fetching cached clubs:', error);
    return [];
  }

  if (!cachedClubs || cachedClubs.length === 0) {
    console.log('No cached clubs found');
    return [];
  }

  console.log(`Found ${cachedClubs.length} cached clubs`);
  const clubs = cachedClubs.map((club: CachedClub) => ({
    id: club.dupr_club_id,
    name: club.club_name,
    role: club.user_role,
  }));

  return clubs;
}

async function updateCachedClubs(
  supabase: ReturnType<typeof createClient>,
  duprId: string,
  clubs: DuprClub[],
  rawClubData: unknown
): Promise<void> {
  console.log(`Updating cache with ${clubs.length} clubs for DUPR ID ${duprId}`);

  try {
    const { error: deleteError } = await supabase
      .from('user_dupr_clubs')
      .delete()
      .eq('dupr_id', duprId);

    if (deleteError) {
      console.error('Error deleting old cached clubs:', deleteError);
      throw deleteError;
    }

    if (clubs.length === 0) {
      console.log('No clubs to cache, deletion complete');
      return;
    }

    const clubsToInsert = clubs.map((club) => ({
      dupr_id: duprId,
      dupr_club_id: club.id,
      club_name: club.name,
      club_data: rawClubData,
      user_role: club.role || null,
      last_synced_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('user_dupr_clubs')
      .insert(clubsToInsert);

    if (insertError) {
      console.error('Error inserting cached clubs:', insertError);
      throw insertError;
    }

    console.log(`Successfully cached ${clubs.length} clubs`);
  } catch (error) {
    console.error('Error updating cached clubs:', error);
  }
}

async function getDuprClientToken(clientKey: string, clientSecret: string): Promise<string | null> {
  if (!clientKey || !clientSecret) {
    console.error('DUPR_CLIENT_KEY and DUPR_CLIENT_SECRET must be configured');
    return null;
  }
  console.log("Get DUPR Client Token triggered")
  const authString = btoa(`${clientKey}:${clientSecret}`);
  console.log('Attempting DUPR client credentials authentication...');

  try {
    const duprResponse = await fetch('https://prod.mydupr.com/api/auth/v1.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': `${authString}`,
      }
    });

    const contentType = duprResponse.headers.get('content-type');
    console.log('DUPR client auth response status:', duprResponse.status, 'content-type:', contentType);

    let duprResult;
    if (contentType && contentType.includes('application/json')) {
      duprResult = await duprResponse.json();
      console.log('DUPR client auth JSON response:', duprResult);
    } else {
      const textResponse = await duprResponse.text();
      console.error('DUPR client auth returned non-JSON response:', textResponse);
      return null;
    }

    if (!duprResponse.ok) {
      console.error('DUPR client authentication failed:', duprResult.message || duprResponse.status);
      return null;
    }

    if (!duprResult.result?.token) {
      console.error('Invalid response from DUPR: missing token');
      return null;
    }

    console.log('DUPR client authentication successful');
    return duprResult.result.token;
  } catch (error) {
    console.error('Error during DUPR client authentication:', error);
    return null;
  }
}

async function fetchClubsFromDupr(duprId: string, accessToken: string): Promise<{ clubs: DuprClub[]; rawData: unknown } | null> {
  const clubsUrl = `https://prod.mydupr.com/api/user/v1.0/${duprId}/clubs`;
  console.log(`Fetching clubs from URL: ${clubsUrl}`);

  const clubsResponse = await fetch(clubsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  console.log(`DUPR clubs API response status: ${clubsResponse.status}`);
  const contentType = clubsResponse.headers.get('content-type');
  console.log(`DUPR clubs API content-type: ${contentType}`);

  if (!clubsResponse.ok) {
    const errText = await clubsResponse.text();
    console.error('DUPR clubs API error details:', {
      status: clubsResponse.status,
      statusText: clubsResponse.statusText,
      duprId: duprId,
      errorBody: errText.substring(0, 500),
    });

    if (clubsResponse.status === 404) {
      return null;
    }

    if (clubsResponse.status === 401) {
      console.log('Token expired or invalid (401 response)');
      return null;
    }
    console.log('There is an error in the dupr api', clubsResponse)

    return null;
  }

  const clubsJson = await clubsResponse.json();
  console.log('DUPR clubs response structure:', Object.keys(clubsJson));

  const rawList = clubsJson.membership ?? clubsJson.clubs ?? clubsJson ?? clubsJson.result;
  const clubs = normalizeClubs(rawList);
  console.log(`Successfully normalized ${clubs.length} clubs`);

  return { clubs, rawData: clubsJson };
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
    const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth validation error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token', details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('dupr_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.dupr_id) {
      return new Response(
        JSON.stringify({ error: 'No DUPR account linked' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Fetching DUPR clubs for user ${user.id} with DUPR ID: ${profile.dupr_id}`);

    let duprAccessToken: string | null = null;
    let tokenSource = 'none';
    const duprtoken = await getDuprClientToken(clientKey, clientSecret);
    if (!duprtoken) {
      return new Response(
        JSON.stringify({ error: 'Failed to get DUPR client token' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    // Strategy 1: Try using stored user token
    if (duprtoken) {

      const result = await fetchClubsFromDupr(profile.dupr_id, duprtoken);

      if (result) {
        if (result.clubs.length === 0 && result.rawData === null) {
          await updateCachedClubs(supabase, profile.dupr_id, [], null);
          return new Response(
            JSON.stringify({
              clubs: [],
              cached: false,
              message: 'No clubs found for this DUPR account',
              lastSyncedAt: new Date().toISOString()
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        await updateCachedClubs(supabase, profile.dupr_id, result.clubs, result.rawData);

        return new Response(
          JSON.stringify({
            clubs: result.clubs,
            cached: false,
            tokenSource,
            lastSyncedAt: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('User token failed (likely expired), attempting refresh...');
    }

    console.log('All token strategies failed, falling back to cached data');
    const cachedClubs = await getCachedClubs(supabase, profile.dupr_id);

    if (cachedClubs.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Failed to authenticate with DUPR and no cached data available',
          details: 'All authentication methods failed. Please reconnect your DUPR account.',
          clubs: [],
          cached: false,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: syncData } = await supabase
      .from('user_dupr_clubs')
      .select('last_synced_at')
      .eq('dupr_id', profile.dupr_id)
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSyncedAt = syncData?.last_synced_at || null;

    console.log(`Returning ${cachedClubs.length} cached clubs`);
    return new Response(
      JSON.stringify({
        clubs: cachedClubs,
        cached: true,
        lastSyncedAt,
        warning: 'DUPR authentication failed - showing cached data. Please reconnect your DUPR account if data seems outdated.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in dupr-user-clubs function:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch clubs',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
