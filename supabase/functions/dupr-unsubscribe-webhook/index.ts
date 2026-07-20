import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DUPR_BASE = "https://prod.mydupr.com/api";

async function getDuprClientToken(): Promise<string> {
  const clientKey = Deno.env.get("DUPR_CLIENT_KEY")!;
  const clientSecret = Deno.env.get("DUPR_CLIENT_SECRET")!;
  const authString = btoa(`${clientKey}:${clientSecret}`);
  const res = await fetch(`${DUPR_BASE}/auth/v1.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-authorization": authString },
  });
  const body = await res.json();
  if (!res.ok || !body.result?.token) {
    throw new Error(`DUPR client auth failed: ${JSON.stringify(body)}`);
  }
  return body.result.token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Verify the calling user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user session
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // Fetch the user's dupr_id from their profile
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("dupr_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[dupr-unsubscribe-webhook] Profile fetch error:", profileError);
      return json({ error: "Failed to fetch profile" }, 500);
    }

    const duprId: string | null = profile?.dupr_id ?? null;

    // If no dupr_id, nothing to unsubscribe — still clear profile data
    if (!duprId) {
      console.log(`[dupr-unsubscribe-webhook] No dupr_id for user ${user.id}, skipping DUPR unsubscribe`);
      return json({ success: true, message: "No DUPR account linked" }, 200);
    }

    // Call DUPR unsubscribe endpoint
    let duprUnsubscribeResult: unknown = null;
    try {
      const token = await getDuprClientToken();
      const res = await fetch(`${DUPR_BASE}/user/1.0/subscribe/webhook-event`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ duprIds: [duprId], topic: "RATING" }),
      });
      duprUnsubscribeResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn(`[dupr-unsubscribe-webhook] DUPR unsubscribe returned ${res.status}:`, duprUnsubscribeResult);
      } else {
        console.log(`[dupr-unsubscribe-webhook] Unsubscribed ${duprId} from RATING webhook:`, duprUnsubscribeResult);
      }
    } catch (duprErr) {
      // Non-fatal — log and continue with local cleanup
      console.error(`[dupr-unsubscribe-webhook] DUPR API error for ${duprId}:`, duprErr);
    }

    // Clear all DUPR-related data from the user's profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        dupr_id: null,
        dupr_user_id: null,
        dupr_rating: null,
        dupr_singles_rating: null,
        dupr_doubles_rating: null,
        dupr_singles_wins: null,
        dupr_singles_losses: null,
        dupr_doubles_wins: null,
        dupr_doubles_losses: null,
        dupr_data: null,
        dupr_user_token: null,
        dupr_refresh_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[dupr-unsubscribe-webhook] Profile update error:", updateError);
      return json({ error: "Failed to clear DUPR profile data" }, 500);
    }

    // Remove cached DUPR club data
    const { error: clubsError } = await supabase
      .from("user_dupr_clubs")
      .delete()
      .eq("dupr_id", duprId);

    if (clubsError) {
      console.warn("[dupr-unsubscribe-webhook] Club cache deletion failed (non-fatal):", clubsError);
    }

    // Remove cached subscription data
    const { error: subError } = await supabase
      .from("dupr_subscriptions_cache")
      .delete()
      .eq("dupr_id", duprId);

    if (subError) {
      console.warn("[dupr-unsubscribe-webhook] Subscription cache deletion failed (non-fatal):", subError);
    }

    console.log(`[dupr-unsubscribe-webhook] Successfully disconnected DUPR account ${duprId} for user ${user.id}`);
    return json({ success: true, message: "DUPR account disconnected", duprId }, 200);

  } catch (err) {
    console.error("[dupr-unsubscribe-webhook] Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
