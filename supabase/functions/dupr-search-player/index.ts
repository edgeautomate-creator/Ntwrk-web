const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DuprSearchRequest {
  duprId: string;
}

async function getDuprToken(): Promise<string | null> {
  const clientId = Deno.env.get('DUPR_CLIENT_ID');
  const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
  const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');

  if (!clientId || !clientKey || !clientSecret) {
    return null;
  }

  const authString = btoa(`${clientKey}:${clientSecret}`);

  const response = await fetch('https://prod.mydupr.com/api/auth/v1.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId.toString(),
    }),
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  return result.result?.accessToken || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { duprId }: DuprSearchRequest = await req.json();

    if (!duprId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing DUPR ID' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = await getDuprToken();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to authenticate with DUPR API. Please check your DUPR credentials.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let playerData = null;
    let errorMessage = null;

    const directResponse = await fetch(`https://prod.mydupr.com/api/user/v1.0/${encodeURIComponent(duprId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/json',
      },
    });

    if (directResponse.ok) {
      const directResult = await directResponse.json();
      if (directResult.result) {
        playerData = [directResult.result];
      }
    }

    if (!playerData) {
      const searchResponse = await fetch(`https://prod.mydupr.com/api/player/v1.0/search?filter=${encodeURIComponent(duprId)}&limit=10&offset=0&exclude=clubs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json',
        },
      });

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        if (searchResult.result && searchResult.result.length > 0) {
          playerData = searchResult.result;
        }
      } else {
        try {
          const errorResult = await searchResponse.json();
          errorMessage = errorResult.message || `DUPR API error (${searchResponse.status})`;
        } catch {
          errorMessage = `DUPR API error (${searchResponse.status})`;
        }
      }
    }

    if (!playerData || playerData.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage || `DUPR ID "${duprId}" not found. Please verify the ID is correct.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: playerData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error searching DUPR player:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
