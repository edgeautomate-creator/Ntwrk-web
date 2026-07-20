const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DuprAuthRequest {
  email?: string;
  password?: string;
  clientId?: string;
  clientKey?: string;
  clientSecret?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: DuprAuthRequest = await req.json();

    if (body.email && body.password) {
      const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
      const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');

      if (!clientKey || !clientSecret) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error: Missing DUPR credentials' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const authString = btoa(`${clientKey}:${clientSecret}`);

      const duprResponse = await fetch('https://prod.mydupr.com/api/auth/v1.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authString}`,
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username: body.email,
          password: body.password,
        }),
      });

      const duprResult = await duprResponse.json();

      if (!duprResponse.ok) {
        return new Response(
          JSON.stringify({
            error: duprResult.message || 'Failed to authenticate with DUPR UAT',
          }),
          {
            status: duprResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!duprResult.result?.access_token) {
        return new Response(
          JSON.stringify({ error: 'Invalid response from DUPR' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const userToken = duprResult.result.access_token;
      const refreshToken = duprResult.result.refresh_token;

      const userInfoResponse = await fetch('https://prod.mydupr.com/api/user/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      if (!userInfoResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch user info from DUPR' }),
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

      const singlesRating = userData.ratings?.singles || null;
      const doublesRating = userData.ratings?.doubles || null;
      const singlesWins = userData.wins?.singles || 0;
      const singlesLosses = userData.losses?.singles || 0;
      const doublesWins = userData.wins?.doubles || 0;
      const doublesLosses = userData.losses?.doubles || 0;

      return new Response(
        JSON.stringify({
          userToken,
          refreshToken,
          duprId: userData.id,
          email: userData.email,
          fullName,
          stats: {
            singles: singlesRating,
            doubles: doublesRating,
            singlesWins,
            singlesLosses,
            doublesWins,
            doublesLosses,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { clientId, clientKey, clientSecret } = body;

    if (!clientId || !clientKey || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing required credentials' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authString = btoa(`${clientKey}:${clientSecret}`);

    const duprResponse = await fetch('https://prod.mydupr.com/api/auth/v1.0/token', {
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

    const duprResult = await duprResponse.json();

    if (!duprResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: duprResult.message || 'Failed to authenticate with DUPR',
        }),
        {
          status: duprResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: duprResult.result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error authenticating with DUPR:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
