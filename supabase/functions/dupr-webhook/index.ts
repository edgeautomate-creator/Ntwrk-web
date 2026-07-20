import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DUPRLoginEvent {
  eventType: string;
  data: {
    id: string;
    duprId?: string;
    duprUserId?: string;
    email?: string;
    fullName?: string;
    userToken: string;
    refreshToken?: string;
    stats?: {
      singles?: number | string;
      doubles?: number | string;
      singlesWins?: number;
      singlesLosses?: number;
      doublesWins?: number;
      doublesLosses?: number;
    };
    subscriptions?: Array<{
      entitlements?: Record<string, unknown>;
      displayName?: string;
      status?: string;
    }>;
  };
}

interface DUPRRatingEvent {
  clientId: string;
  event: string;
  timestamp: string;
  message: {
    duprId: string;
    name: string;
    rating: {
      singles?: string | null;
      doubles?: string | null;
      mixed?: string | null;
      singlesReliability?: string | null;
      doublesReliability?: string | null;
      matchId?: number | null;
      singlesProvisional?: string | null;
      doublesProvisional?: string | null;
      careerHighSingles?: string | null;
      careerHighDoubles?: string | null;
      ageRating50Plus?: string | null;
      ageRating65Plus?: string | null;
      wins?: number | null;
      losses?: number | null;
    };
  };
}

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

async function subscribeToDuprRatingWebhook(duprId: string): Promise<void> {
  try {
    const token = await getDuprClientToken();
    const res = await fetch(`${DUPR_BASE}/user/1.0/subscribe/webhook-event`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ duprIds: [duprId], topic: "RATING" }),
    });
    const response=await res.json();
    console.log(`[dupr-webhook-response]  for ${duprId} :`, response);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[dupr-webhook] RATING subscription failed for ${duprId}:`, body);
    } else {
      console.log(`[dupr-webhook] Subscribed ${duprId} to RATING webhook:`, body);
    }
  } catch (err) {
    console.error(`[dupr-webhook] Error subscribing ${duprId} to RATING webhook:`, err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Log all incoming request metadata
  console.log("[dupr-webhook] Incoming request:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Parse body once — used for both event types
  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = await req.json();
    console.log("[dupr-webhook] Request payload:", JSON.stringify(rawPayload, null, 2));
  } catch (err) {
    console.error("Failed to parse request body:", err);
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Handle LOGIN event triggered when user connects DUPR account ---
    if ((rawPayload as Record<string, unknown>).eventType === "LOGIN") {
      const event = rawPayload as unknown as DUPRLoginEvent;
      const d = event.data;

      const updateData: Record<string, unknown> = {
        dupr_user_token: d.userToken,
        updated_at: new Date().toISOString(),
      };

      if (d.duprId != null)      updateData.dupr_id           = d.duprId;
      if (d.duprUserId != null)  updateData.dupr_user_id      = String(d.duprUserId);
      if (d.refreshToken != null) updateData.dupr_refresh_token = d.refreshToken;
      if (d.fullName || d.email) updateData.full_name          = d.fullName || d.email;

      const singlesRaw = d.stats?.singles;
      const doublesRaw = d.stats?.doubles;
      if (singlesRaw !== undefined)
        updateData.dupr_singles_rating = singlesRaw === "NR" ? null : singlesRaw;
      if (doublesRaw !== undefined)
        updateData.dupr_doubles_rating = doublesRaw === "NR" ? null : doublesRaw;
      if (d.stats?.singlesWins  !== undefined) updateData.dupr_singles_wins   = d.stats.singlesWins;
      if (d.stats?.singlesLosses !== undefined) updateData.dupr_singles_losses = d.stats.singlesLosses;
      if (d.stats?.doublesWins  !== undefined) updateData.dupr_doubles_wins   = d.stats.doublesWins;
      if (d.stats?.doublesLosses !== undefined) updateData.dupr_doubles_losses = d.stats.doublesLosses;

      console.log(`[dupr-webhook] LOGIN — userId: ${d.id}, duprId: ${d.duprId ?? "none"}`);

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", d.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
        return json({ error: "Failed to update profile" }, 500);
      }

      // Cache subscription data if present
      if (d.duprId && d.subscriptions && d.subscriptions.length > 0) {
        try {
          const sub = d.subscriptions[0];
          const entitlements = sub.entitlements ?? {};
          await supabase.from("dupr_subscriptions_cache").upsert({
            dupr_id: d.duprId,
            entitlements,
            tournaments: (entitlements as any)?.tournaments ?? [],
            merchandise: (entitlements as any)?.merchandise ?? [],
            display_name: sub.displayName ?? null,
            status: sub.status ?? null,
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: "dupr_id" });
        } catch (subErr) {
          console.warn("Subscription cache failed (non-fatal):", subErr);
        }
      }

      // Subscribe the user to RATING webhook events on DUPR
      if (d.duprId) {
        EdgeRuntime.waitUntil(subscribeToDuprRatingWebhook(d.duprId));
      }

      return json({ success: true, message: "Profile updated" }, 200);
    }

    // --- Handle RATING event from DUPR webhook ---
    if ((rawPayload as Record<string, unknown>).event === "RATING") {
      // Validate shared secret header
      console.log("Rating Triggered");
      const incomingSecret = req.headers.get("x-dupr-signature") ?? "";
      const expectedSecret = Deno.env.get("DUPR_WEBHOOK_SECRET") ?? "";
      if (!expectedSecret || incomingSecret !== expectedSecret) {
        return json({ error: "Unauthorized" }, 401);
      }

      const event = rawPayload as unknown as DUPRRatingEvent;
      const message = event.message ?? {};
      const rating = message.rating ?? {};

      const duprId = message.duprId ?? null;
      if (!duprId) {
        return json({ error: "Missing duprId in payload" }, 400);
      }

      // Map all fields defensively with null fallbacks
      const record = {
        dupr_id:              duprId,
        player_name:          message.name              ?? null,

        singles:              rating.singles             ?? null,
        doubles:              rating.doubles             ?? null,
        mixed:                rating.mixed               ?? null,

        singles_reliability:  rating.singlesReliability  ?? null,
        doubles_reliability:  rating.doublesReliability  ?? null,

        singles_provisional:  rating.singlesProvisional  ?? null,
        doubles_provisional:  rating.doublesProvisional  ?? null,

        career_high_singles:  rating.careerHighSingles   ?? null,
        career_high_doubles:  rating.careerHighDoubles   ?? null,

        age_rating_50_plus:   rating.ageRating50Plus     ?? null,
        age_rating_65_plus:   rating.ageRating65Plus     ?? null,

        wins:                 rating.wins                ?? null,
        losses:               rating.losses              ?? null,
        match_id:             rating.matchId             ?? null,

        // Full raw payload stored for audit and replay
        raw_payload:          rawPayload,
      };
      
      const { error } = await supabase
        .from("player_ratings")
        .upsert(record, {
          onConflict: "dupr_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Supabase upsert error:", error);
        return json({ error: error.message }, 500);
      }

      console.log(`Rating upserted — duprId: ${duprId}, timestamp: ${event.timestamp ?? "unknown"}`);
      return json({ success: true, duprId }, 200);
    }

    // Unknown event type — acknowledge receipt
    return json({ message: "Event received" }, 200);

  } catch (error) {
    console.error("Error processing webhook:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
