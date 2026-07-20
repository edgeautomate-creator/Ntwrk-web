/*
  # Allow public pickup sessions to be viewable and joinable via shared link

  Fix PGRST116 when a non-creator opens a shared pickup session link: allow any
  authenticated user to view and join sessions where visibility = 'public'.

  ## Changes
  - pickup_sessions SELECT: add OR visibility = 'public'
  - pickup_session_players SELECT + INSERT: session subquery includes OR visibility = 'public'
  - pickup_rounds SELECT: session subquery includes OR visibility = 'public'
  - pickup_matchups SELECT: session subquery includes OR visibility = 'public'
*/

-- ==========================================
-- 1. pickup_sessions SELECT
-- ==========================================
DROP POLICY IF EXISTS "Users can view pickup sessions" ON pickup_sessions;
CREATE POLICY "Users can view pickup sessions"
  ON pickup_sessions FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR tenant_id IS NULL
    OR tenant_id IN (
      SELECT organization_id
      FROM user_roles
      WHERE user_id = auth.uid()
    )
    OR visibility = 'public'
  );

-- ==========================================
-- 2. pickup_session_players SELECT + INSERT
-- ==========================================
DROP POLICY IF EXISTS "Users can view players in sessions they can view" ON pickup_session_players;
CREATE POLICY "Users can view players in sessions they can view"
  ON pickup_session_players FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions
      WHERE created_by = auth.uid()
        OR tenant_id IS NULL
        OR tenant_id IN (
          SELECT organization_id
          FROM user_roles
          WHERE user_id = auth.uid()
        )
        OR visibility = 'public'
    )
  );

DROP POLICY IF EXISTS "Users can join pickup sessions or creators can add players" ON pickup_session_players;
CREATE POLICY "Users can join pickup sessions or creators can add players"
  ON pickup_session_players FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM pickup_sessions
      WHERE created_by = auth.uid()
        OR tenant_id IS NULL
        OR tenant_id IN (
          SELECT organization_id
          FROM user_roles
          WHERE user_id = auth.uid()
        )
        OR visibility = 'public'
    )
    AND (
      session_id IN (SELECT id FROM pickup_sessions WHERE created_by = auth.uid())
      OR user_id = auth.uid()
      OR user_id IS NULL
    )
  );

-- ==========================================
-- 3. pickup_rounds SELECT
-- ==========================================
DROP POLICY IF EXISTS "Users can view rounds in sessions they can view" ON pickup_rounds;
CREATE POLICY "Users can view rounds in sessions they can view"
  ON pickup_rounds FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM pickup_sessions
      WHERE created_by = auth.uid()
        OR tenant_id IS NULL
        OR tenant_id IN (
          SELECT organization_id
          FROM user_roles
          WHERE user_id = auth.uid()
        )
        OR visibility = 'public'
    )
  );

-- ==========================================
-- 4. pickup_matchups SELECT
-- ==========================================
DROP POLICY IF EXISTS "Users can view matchups in sessions they can view" ON pickup_matchups;
CREATE POLICY "Users can view matchups in sessions they can view"
  ON pickup_matchups FOR SELECT
  TO authenticated
  USING (
    round_id IN (
      SELECT id FROM pickup_rounds
      WHERE session_id IN (
        SELECT id FROM pickup_sessions
        WHERE created_by = auth.uid()
          OR tenant_id IS NULL
          OR tenant_id IN (
            SELECT organization_id
            FROM user_roles
            WHERE user_id = auth.uid()
          )
          OR visibility = 'public'
      )
    )
  );
