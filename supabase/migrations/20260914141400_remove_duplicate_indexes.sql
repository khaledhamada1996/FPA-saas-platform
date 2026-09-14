-- Remove redundant duplicate indexes reported by the Supabase performance advisor.
-- Keep the indexes that are referenced by composite foreign-key constraints.
DROP INDEX IF EXISTS public.branches_organization_id_idx;
DROP INDEX IF EXISTS public.idx_data_lineage_normalized;
DROP INDEX IF EXISTS public.legal_entities_org_id_id_key;
DROP INDEX IF EXISTS public.organization_one_company_admin_idx;
