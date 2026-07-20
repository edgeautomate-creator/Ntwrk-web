-- Set JWT expiry to maximum (604800 seconds = 7 days)
-- This is a config change applied via Supabase Auth settings
-- The actual JWT lifetime is controlled by auth.config, not SQL,
-- but we document the intent here for traceability.
DO $$ BEGIN
  RAISE NOTICE 'JWT expiry target: 604800 seconds (7 days). Update via Supabase Dashboard > Authentication > JWT Settings.';
END $$;
