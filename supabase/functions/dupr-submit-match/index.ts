import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the user's DUPR access token from their profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("dupr_user_token, dupr_refresh_token")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!profile.dupr_user_token) {
      return new Response(
        JSON.stringify({ error: "DUPR account not linked. Please connect your DUPR account first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { matchData } = await req.json();

    if (!matchData) {
      return new Response(
        JSON.stringify({ error: "Match data is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields in matchData
    if (!matchData.eventName || !matchData.matchDate || !matchData.teams || !matchData.scores) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields. Required: eventName, matchDate, teams, scores"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Submitting match to DUPR:", JSON.stringify(matchData, null, 2));

    // Submit to DUPR using the user's access token
    const duprResponse = await fetch("https://api.dupr.gg/match/v1.0/save", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${profile.dupr_user_token}`,
      },
      body: JSON.stringify(matchData),
    });

    const duprResult = await duprResponse.json();
    console.log("DUPR Response:", JSON.stringify(duprResult, null, 2));

    if (!duprResponse.ok) {
      // If token expired, try to refresh
      if (duprResponse.status === 401 && profile.dupr_refresh_token) {
        console.log("Access token expired, attempting refresh...");

        const refreshResponse = await fetch("https://api.dupr.gg/auth/v1.0/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: profile.dupr_refresh_token,
          }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const newAccessToken = refreshData.result?.accessToken || refreshData.accessToken;

          // Update the profile with new token
          await supabase
            .from("profiles")
            .update({ dupr_access_token: newAccessToken })
            .eq("id", user.id);

          // Retry the match submission with new token
          const retryResponse = await fetch("https://api.dupr.gg/match/v1.0/save", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${newAccessToken}`,
            },
            body: JSON.stringify(matchData),
          });

          const retryResult = await retryResponse.json();

          if (!retryResponse.ok) {
            return new Response(
              JSON.stringify({
                success: false,
                error: retryResult.message || "Failed to submit to DUPR after token refresh",
              }),
              {
                status: retryResponse.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Match submitted to DUPR successfully",
              duprResponse: retryResult,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: duprResult.message || "Failed to submit to DUPR",
        }),
        {
          status: duprResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Match submitted to DUPR successfully",
        duprResponse: duprResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error submitting match to DUPR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
