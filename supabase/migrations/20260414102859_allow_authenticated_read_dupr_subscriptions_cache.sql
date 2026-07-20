/*
  # Broaden dupr_subscriptions_cache SELECT policy

  ## Summary
  Updates the RLS SELECT policy on dupr_subscriptions_cache to allow any authenticated
  user to read any row. This is needed so that when a player tries to join a tournament
  with a DUPR+ subscription requirement, the client-side join check can look up the
  player's cached subscription data.

  ## Security Notes
  - Subscription tier data (e.g., "BASIC_L1", "PREMIUM_L1") is not personally sensitive
  - The previous policy restricted reads to only a user's own row, which prevented the
    tournament join validation from working for players looking up their own data keyed
    by dupr_id
  - Write operations remain restricted to service_role only
*/

DROP POLICY IF EXISTS "Authenticated users can read own subscription cache" ON dupr_subscriptions_cache;

CREATE POLICY "Authenticated users can read subscription cache"
  ON dupr_subscriptions_cache
  FOR SELECT
  TO authenticated
  USING (true);
