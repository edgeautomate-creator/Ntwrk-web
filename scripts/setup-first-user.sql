-- Run this in Supabase SQL Editor after creating your first user
-- Replace 'YOUR_USER_EMAIL' with the email you used to sign up

-- 1. First, find your user ID
-- SELECT id, email FROM auth.users;

-- 2. Create an organization
INSERT INTO organizations (name, slug, subscription_tier, subscription_status, max_leagues, max_players, features)
VALUES (
  'My Pickleball League',
  'my-league',
  'pro',
  'active',
  999,
  999,
  '{"dupr_integration": true, "advanced_analytics": true, "tournament_mode": true}'::jsonb
)
RETURNING id;

-- 3. Link your user to the organization (replace YOUR_USER_ID and YOUR_ORG_ID)
-- Get YOUR_USER_ID from step 1, get YOUR_ORG_ID from step 2
INSERT INTO organization_users (organization_id, user_id, role, email, full_name)
VALUES (
  'YOUR_ORG_ID',  -- Replace with organization id from step 2
  'YOUR_USER_ID', -- Replace with your user id from step 1
  'super_admin',
  'YOUR_USER_EMAIL', -- Replace with your email
  'Admin User'
);
