-- 022: Fix security_definer_view on reports_daily_meta
-- Views default to definer privileges (bypass RLS). Force invoker mode.

ALTER VIEW public.reports_daily_meta SET (security_invoker = on);

NOTIFY pgrst, 'reload schema';
