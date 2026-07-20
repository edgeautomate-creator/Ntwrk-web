/*
  # Enforce DUPR subscription requirements at the database level

  ## Summary
  Previously, subscription checks for DUPR+ required tournaments were only
  performed on the frontend, meaning they could be bypassed via direct API calls.
  This migration moves the enforcement into the database layer.

  ## Changes

  ### New Function
  - `check_dupr_subscription_for_tournament(tournament_id uuid, user_id uuid)`
    Returns TRUE if the user satisfies the subscription requirements for a given
    tournament. Specifically:
    - If the tournament has no `dupr_plus_required_subs`, always returns TRUE.
    - Otherwise looks up the user's `dupr_id` from `profiles`, then checks
      `dupr_subscriptions_cache` to confirm:
        a) a non-expired cache row exists for that dupr_id, AND
        b) at least one of the user's `tournaments` entitlements matches
           the tournament's required tiers.

  ### Modified RLS Policies on `tournament_teams`

  1. **INSERT — "Users can register for round robin individual tournaments"**
     Dropped and recreated to additionally call
     `check_dupr_subscription_for_tournament` so direct API inserts are blocked
     when the user lacks the required subscription.

  2. **UPDATE — "Users can claim slots or update their teams"**
     Dropped and recreated to additionally call
     `check_dupr_subscription_for_tournament` so direct API updates (slot claims)
     are blocked when the user lacks the required subscription.

  ## Security Notes
  - The function is `SECURITY DEFINER` so it can read `profiles` and
    `dupr_subscriptions_cache` regardless of the caller's RLS context.
  - The function is marked `STABLE` (read-only) and `SET search_path = ''` for
    safety.
  - Tournament creators are NOT exempted — if a tournament requires a
    subscription they must also hold it to register themselves as a player.
*/

-- Helper function: returns TRUE when the user meets the subscription requirements
CREATE OR REPLACE FUNCTION check_dupr_subscription_for_tournament(
  p_tournament_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_required_subs text[];
  v_dupr_id       text;
  v_user_subs     text[];
  v_expires_at    timestamptz;
BEGIN
  -- Fetch the required subscription tiers for this tournament
  SELECT dupr_plus_required_subs
  INTO v_required_subs
  FROM public.tournaments
  WHERE id = p_tournament_id;

  -- No subscription requirement -> allow
  IF v_required_subs IS NULL OR array_length(v_required_subs, 1) IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Get user's DUPR id from their profile
  SELECT dupr_id
  INTO v_dupr_id
  FROM public.profiles
  WHERE id = p_user_id;

  -- User has no DUPR id -> fail (they don't have any subscription)
  IF v_dupr_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Look up the subscription cache
  SELECT tournaments, expires_at
  INTO v_user_subs, v_expires_at
  FROM public.dupr_subscriptions_cache
  WHERE dupr_id = v_dupr_id;

  -- No cache row, or cache row has expired -> fail
  IF v_user_subs IS NULL OR v_expires_at < now() THEN
    RETURN FALSE;
  END IF;

  -- Check that at least one required tier is present in the user's entitlements
  IF v_user_subs && v_required_subs THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- -----------------------------------------------------------------------
-- INSERT policy: round_robin_individual self-registration
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can register for round robin individual tournaments"
  ON public.tournament_teams;

CREATE POLICY "Users can register for round robin individual tournaments"
  ON public.tournament_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    player1_user_id = auth.uid()
    AND player2_user_id IS NULL
    AND player2_name IS NULL
    AND EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = tournament_teams.tournament_id
        AND tournaments.format = 'round_robin_individual'
        AND (tournaments.is_private = false OR tournaments.created_by = auth.uid())
    )
    AND check_dupr_subscription_for_tournament(tournament_teams.tournament_id, auth.uid())
  );

-- -----------------------------------------------------------------------
-- UPDATE policy: users claiming empty slots in their own name
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can claim slots or update their teams"
  ON public.tournament_teams;

CREATE POLICY "Users can claim slots or update their teams"
  ON public.tournament_teams
  FOR UPDATE
  TO authenticated
  USING (
    (player1_name IS NULL OR player2_name IS NULL
     OR auth.uid() = player1_user_id OR auth.uid() = player2_user_id)
  )
  WITH CHECK (
    (auth.uid() = player1_user_id OR auth.uid() = player2_user_id)
    AND check_dupr_subscription_for_tournament(tournament_teams.tournament_id, auth.uid())
  );
