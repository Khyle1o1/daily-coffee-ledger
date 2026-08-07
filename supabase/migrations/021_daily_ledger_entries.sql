-- 021: daily_ledger_entries — day × branch cash ledger (sheet or POS-derived)
-- Matches Google Sheets Daily Ledger columns for Cash/Maya/Paymongo/discounts/etc.

CREATE TABLE IF NOT EXISTS public.daily_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  ledger_date DATE NOT NULL,

  cash NUMERIC(14, 2) NOT NULL DEFAULT 0,
  maya NUMERIC(14, 2) NOT NULL DEFAULT 0,
  grab NUMERIC(14, 2) NOT NULL DEFAULT 0,
  paymongo NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gcash NUMERIC(14, 2) NOT NULL DEFAULT 0,
  foodpanda NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gift_card NUMERIC(14, 2) NOT NULL DEFAULT 0,

  regular_discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  senior_discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  pwd_discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  vat_exemption NUMERIC(14, 2) NOT NULL DEFAULT 0,

  gross_sales_net NUMERIC(14, 2) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  gross_sales NUMERIC(14, 2) NOT NULL DEFAULT 0,

  source TEXT NOT NULL CHECK (source IN ('sheet', 'pos_derived', 'pos_partial')),
  source_file_name TEXT,
  user_id UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_daily_ledger_branch_date UNIQUE (branch_id, ledger_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_ledger_branch ON public.daily_ledger_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_ledger_date ON public.daily_ledger_entries(ledger_date);
CREATE INDEX IF NOT EXISTS idx_daily_ledger_branch_date
  ON public.daily_ledger_entries(branch_id, ledger_date);

ALTER TABLE public.daily_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_ledger_auth_read" ON public.daily_ledger_entries;
CREATE POLICY "daily_ledger_auth_read"
  ON public.daily_ledger_entries
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "daily_ledger_auth_insert" ON public.daily_ledger_entries;
CREATE POLICY "daily_ledger_auth_insert"
  ON public.daily_ledger_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_ledger_auth_update" ON public.daily_ledger_entries;
CREATE POLICY "daily_ledger_auth_update"
  ON public.daily_ledger_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = user_id OR public.current_user_is_admin());

DROP POLICY IF EXISTS "daily_ledger_auth_delete" ON public.daily_ledger_entries;
CREATE POLICY "daily_ledger_auth_delete"
  ON public.daily_ledger_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin());
