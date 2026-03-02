-- Migration: Add generated_reports table for saving HQ-style generated reports

CREATE TABLE IF NOT EXISTS public.generated_reports (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  report_type    text        NOT NULL,
  branch_id      uuid        REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name    text        NOT NULL DEFAULT '',
  date_from      text        NOT NULL,
  date_to        text        NOT NULL,
  compare_from   text,
  compare_to     text,
  selected_categories text[] NOT NULL DEFAULT '{}',
  filters        jsonb       NOT NULL DEFAULT '{}',
  computed_data  jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own generated reports
CREATE POLICY "generated_reports_owner_policy"
  ON public.generated_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast queries by user + created_at
CREATE INDEX IF NOT EXISTS generated_reports_user_id_idx
  ON public.generated_reports (user_id);

CREATE INDEX IF NOT EXISTS generated_reports_created_at_idx
  ON public.generated_reports (created_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_generated_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generated_reports_updated_at
  BEFORE UPDATE ON public.generated_reports
  FOR EACH ROW EXECUTE FUNCTION update_generated_reports_updated_at();
