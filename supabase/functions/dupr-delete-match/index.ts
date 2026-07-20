import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getDuprToken(clientKey: string, clientSecret: string): Promise<string> {
  if (!clientKey || !clientSecret) {
    throw new Error('DUPR_CLIENT_KEY and DUPR_CLIENT_SECRET must be configured');
  }
  const authString = btoa(`${clientKey}:${clientSecret}`);
  const duprResponse = await fetch(`https://prod.mydupr.com/api/auth/v1.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-authorization': authString,
    },
  });
  const contentType = duprResponse.headers.get('content-type');
  let duprResult: { result?: { token?: string }; message?: string };
  if (contentType?.includes('application/json')) {
    duprResult = await duprResponse.json();
  } else {
    const text = await duprResponse.text();
    throw new Error(`DUPR auth failed: ${text.substring(0, 100)}`);
  }
  if (!duprResponse.ok) {
    throw new Error(duprResult.message || `DUPR auth failed ${duprResponse.status}`);
  }
  if (!duprResult.result?.token) {
    throw new Error('Invalid DUPR response: missing token');
  }
  return duprResult.result.token;
}

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
    const clientKey = Deno.env.get('DUPR_CLIENT_KEY');
    const clientSecret = Deno.env.get('DUPR_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { matchId } = await req.json();

    if (!matchId) {
      return new Response(
        JSON.stringify({
          error: "Missing required field: matchId"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: match, error: matchError } = await supabase
      .from("tournament_matches")
      .select("dupr_match_id, dupr_match_identifier, deleted_at")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) {
      return new Response(
        JSON.stringify({ error: "Match not found in database" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!match.dupr_match_id && !match.dupr_match_identifier) {
      const { error: deleteError } = await supabase
        .from("tournament_matches")
        .delete()
        .eq("id", matchId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Failed to delete match from database" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Match deleted (was not synced to DUPR)",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Deleting match from DUPR:", {
      matchId,
      duprMatchId: match.dupr_match_id,
      duprMatchIdentifier: match.dupr_match_identifier
    });

    if (!match.dupr_match_identifier) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Match has dupr_match_id but missing dupr_match_identifier",
          note: "Cannot delete from DUPR without identifier"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const deletePayload: any = {
      matchCode: match.dupr_match_id,
      identifier: match.dupr_match_identifier
    };
    const duprToken = await getDuprToken(clientKey!, clientSecret!);

    const duprResponse = await fetch("https://prod.mydupr.com/api/match/v1.0/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${duprToken}`,
      },
      body: JSON.stringify(deletePayload),
    });

    const duprResult = await duprResponse.json();
    console.log("DUPR Delete Response:", JSON.stringify(duprResult, null, 2));

    if (!duprResponse.ok) {
      await supabase
        .from("tournament_matches")
        .update({ dupr_deletion_status: 'failed' })
        .eq("id", matchId);

      return new Response(
        JSON.stringify({
          success: false,
          error: duprResult.message || "Failed to delete from DUPR",
          note: "Match marked as deleted locally, DUPR deletion failed"
        }),
        {
          status: duprResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (match.deleted_at) {
      const { error: updateError } = await supabase
        .from("tournament_matches")
        .update({ dupr_deletion_status: 'success' })
        .eq("id", matchId);

      if (updateError) {
        console.error("Failed to update database status:", updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Deleted from DUPR but failed to update database status",
            duprDeleted: true,
            dbError: updateError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Match deleted from DUPR successfully (already deleted locally)",
          duprResponse: duprResult,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: deleteError } = await supabase
      .from("tournament_matches")
      .delete()
      .eq("id", matchId);

    if (deleteError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Deleted from DUPR but failed to delete from database",
          duprDeleted: true
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Match deleted from both DUPR and database successfully",
        duprResponse: duprResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error deleting match from DUPR:", error);

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
