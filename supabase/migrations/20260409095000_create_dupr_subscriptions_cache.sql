/*
  # Create DUPR Subscriptions Cache Table

  ## Purpose
  Cache DUPR subscription entitlements keyed on dupr_id (the DUPR platform identifier),
  not the internal Supabase user ID. This allows lookups by DUPR player regardless of
  whether they have an app account.

  ## New Tables
  - `dupr_subscriptions_cache`
    - `dupr_id` (text, primary key) - the DUPR platform player ID
    - `tournaments` (text[]) - entitlements for tournament features (e.g., "BASIC_L1")
    - `merchandise` (text[]) - entitlements for merchandise features
    - `display_name` (text) - subscription display name (e.g., "DUPR")
    - `status` (text) - subscription status (e.g., "active")
    - `cached_at` (timestamptz) - when this record was last written
    - `expires_at` (timestamptz) - 24 hours after cached_at; records past this are stale

  ## Security
  - RLS enabled
  - Authenticated users can read their own subscription data (via profiles.dupr_id join)
  - Only service role can insert/update/delete (writes done from edge functions)
*/

CREATE TABLE IF NOT EXISTS dupr_subscriptions_cache (
  dupr_id      text PRIMARY KEY,
  tournaments  text[] NOT NULL DEFAULT '{}',
  merchandise  text[] NOT NULL DEFAULT '{}',
  display_name text,
  status       text,
  cached_at    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE dupr_subscriptions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read own subscription cache"
  ON dupr_subscriptions_cache
  FOR SELECT
  TO authenticated
  USING (
    dupr_id IN (
      SELECT dupr_id FROM profiles WHERE id = auth.uid() AND dupr_id IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert subscription cache"
  ON dupr_subscriptions_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update subscription cache"
  ON dupr_subscriptions_cache
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete subscription cache"
  ON dupr_subscriptions_cache
  FOR DELETE
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_dupr_subscriptions_cache_expires_at
  ON dupr_subscriptions_cache (expires_at);
