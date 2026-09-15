-- Repair account parent relationships from the activity reporting blueprint.
-- This is organization-agnostic: every organization's selected activity determines its hierarchy.

update public.accounts as child
set parent_account_id = parent.id
from public.accounts as parent,
     public.organizations as o,
     public.activity_account_blueprints as bp,
     public.activity_account_blueprints as pp
where child.organization_id=o.id
  and bp.activity_key=o.activity_key
  and bp.code=child.code
  and pp.activity_key=bp.activity_key
  and pp.code=bp.parent_code
  and bp.parent_code is not null
  and parent.organization_id=o.id
  and parent.code=pp.code
  and parent.id<>child.id;

update public.accounts as child
set parent_account_id = null
from public.organizations as o,
     public.activity_account_blueprints as bp
where child.organization_id=o.id
  and bp.activity_key=o.activity_key
  and bp.code=child.code
  and bp.parent_code is null;
