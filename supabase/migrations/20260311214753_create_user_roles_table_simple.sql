/*
  # Create User Roles Table (Simple Version)

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, not null) - References auth.users
      - `organization_id` (uuid, not null) - Organization identifier (not FK for now)
      - `role` (text, not null) - User's role within the organization
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on `user_roles` table
    - Add policy for users to read their own roles
    
  3. Indexes
    - Index on user_id for fast lookups
    - Index on organization_id for organization queries
    - Unique constraint on (user_id, organization_id) to prevent duplicate assignments

  4. Notes
    - organization_id is not a foreign key since organizations table doesn't exist yet
    - This allows for future expansion when organizations are added
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member', 'viewer', 'creator')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON user_roles(user_id, organization_id);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own roles (for self-registration)
CREATE POLICY "Users can create own roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all roles in their org
CREATE POLICY "Org admins can view org roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Policy: Admins can manage roles in their org
CREATE POLICY "Org admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE user_roles IS 'User roles within organizations';
COMMENT ON COLUMN user_roles.user_id IS 'References the user';
COMMENT ON COLUMN user_roles.organization_id IS 'References the organization';
COMMENT ON COLUMN user_roles.role IS 'User''s role within the organization (admin, member, viewer, creator)';
COMMENT ON COLUMN user_roles.created_at IS 'Creation timestamp';
