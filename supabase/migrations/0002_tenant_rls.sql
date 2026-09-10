-- Tenant-aware access policies for the authenticated application.
-- Database policies provide a second isolation boundary in addition to server-side authorization.

CREATE OR REPLACE FUNCTION public.is_org_member(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = target_organization_id
      AND user_id = auth.uid()
  );
$$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "members can read their organizations"
ON organizations FOR SELECT
TO authenticated
USING (public.is_org_member(id));

CREATE POLICY "members can read memberships in their organizations"
ON organization_members FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_org_member(organization_id));

CREATE POLICY "users can create their own membership"
ON organization_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "members can read audit events for their organizations"
ON audit_events FOR SELECT
TO authenticated
USING (public.is_org_member(organization_id));

CREATE POLICY "members can create audit events for their organizations"
ON audit_events FOR INSERT
TO authenticated
WITH CHECK (actor_user_id = auth.uid() AND public.is_org_member(organization_id));
