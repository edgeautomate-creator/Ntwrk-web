/*
  # Allow authenticated users to upsert their own subscription cache

  ## Problem
  The dupr_subscriptions_cache table previously only allowed service_role to
  insert/update. The dupr-login page uses the authenticated Supabase client,
  so upserts were silently blocked by RLS.

  ## Changes
  - Add INSERT policy for authenticated users writing their own dupr_id row
  - Add UPDATE policy for authenticated users updating their own dupr_id row

  Both policies join to profiles to confirm the dupr_id belongs to the
  requesting user.
*/

CREATE POLICY "Authenticated users can insert own subscription cache"
  ON dupr_subscriptions_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    dupr_id IN (
      SELECT dupr_id FROM profiles WHERE id = auth.uid() AND dupr_id IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can update own subscription cache"
  ON dupr_subscriptions_cache
  FOR UPDATE
  TO authenticated
  USING (
    dupr_id IN (
      SELECT dupr_id FROM profiles WHERE id = auth.uid() AND dupr_id IS NOT NULL
    )
  )
  WITH CHECK (
    dupr_id IN (
      SELECT dupr_id FROM profiles WHERE id = auth.uid() AND dupr_id IS NOT NULL
    )
  );
