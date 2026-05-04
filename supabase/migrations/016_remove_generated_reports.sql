-- Migration: remove generated report history storage to reduce DB load

-- Drop trigger first so table removal is clean in all environments.
DROP TRIGGER IF EXISTS generated_reports_updated_at ON public.generated_reports;

-- Remove trigger function if it exists.
DROP FUNCTION IF EXISTS public.update_generated_reports_updated_at();

-- Remove RLS policy if table still exists.
DROP POLICY IF EXISTS "generated_reports_owner_policy" ON public.generated_reports;

-- Remove the generated report history table.
DROP TABLE IF EXISTS public.generated_reports;
