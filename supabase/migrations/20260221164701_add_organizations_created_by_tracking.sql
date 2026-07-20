/*
  # Add Created By Tracking to Organizations

  ## Changes
  1. Add `created_by` column to organizations table
  2. Backfill existing organizations with a default value
  3. Update RLS policy to check that users can only create organizations for themselves
  4. Add trigger to automatically create org_admin role when organization is created

  ## Security
  - Organizations can only be created by authenticated users
  - The creator is automatically assigned as org_admin via trigger
  - Users can only create organizations where they are the creator
*/

-- Add created_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE organizations ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Backfill existing organizations with first admin user or system user
UPDATE organizations
SET created_by = (
  SELECT user_id
  FROM user_roles
  WHERE user_roles.organization_id = organizations.id
  AND user_roles.role = 'org_admin'
  LIMIT 1
)
WHERE created_by IS NULL;

-- Make created_by NOT NULL after backfill
ALTER TABLE organizations ALTER COLUMN created_by SET NOT NULL;

-- Drop the old policy and create a restrictive one
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

CREATE POLICY "Users can create organizations for themselves"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Create trigger to auto-assign org_admin role when organization is created
CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (NEW.created_by, NEW.id, 'org_admin');
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organization();
