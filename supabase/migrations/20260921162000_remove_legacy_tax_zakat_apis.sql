-- Remove legacy tax/zakat calculation APIs superseded by the versioned calculation workflow.
drop function if exists public.calculate_tax_zakat(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid);
drop function if exists public.calculate_tax_zakat(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,numeric,numeric,numeric);
