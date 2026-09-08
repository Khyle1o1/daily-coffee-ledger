-- 028: Pre-aggregated line rollup so long generates stop shipping raw POS lines.
--
-- Every report on ReportsPage reduces rowDetails to sums of quantity and
-- rowSales keyed by category, item and channel. None of them reads unitPrice,
-- counts transactions, or otherwise needs an individual POS line. The browser
-- was downloading the raw lines only to fold them away.
--
-- Measured over 2026, all 23 branches:
--
--   MAPPED line rows                          669,967
--   (report, date, item, category, channel)   ~135,000   4.9x smaller
--
-- Aggregating at that grain is lossless for those reports and drops the
-- browser payload from ~158 MB to ~15 MB.
--
-- Note this table is a ROLLUP, not raw lines: one row per
-- (report_id, txn_date, item_name, category, channel). report_id is part of
-- the grain so overlapping-report ownership still resolves the same way.
--
-- Aggregating straight off summary_json at query time would re-create the
-- problem 026 fixed — jsonb_array_elements forces a full detoast of the
-- ~296 MB rowDetails blob. Maintaining the rollup on write means read queries
-- touch an ordinary indexed table instead. The rebuild function is the one
-- place jsonb_array_elements is allowed, and it runs per report on INSERT /
-- UPDATE, never across the whole table.

-- 1. Rollup table -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_line_totals (
  report_id         uuid        NOT NULL
                      REFERENCES public.reports_daily(id) ON DELETE CASCADE,
  branch_id         uuid        NOT NULL,
  txn_date          date        NOT NULL,
  item_name         text        NOT NULL,
  category          text        NOT NULL,
  -- Derived channel, mirroring getChannelFromPaymentType in src/lib/reports/channel.ts.
  channel           text        NOT NULL,
  qty               numeric(14,3) NOT NULL DEFAULT 0,
  sales             numeric(14,2) NOT NULL DEFAULT 0,
  gross_price       numeric(14,2) NOT NULL DEFAULT 0,
  discounted_price  numeric(14,2) NOT NULL DEFAULT 0,
  regular_discount  numeric(14,2) NOT NULL DEFAULT 0,
  senior_discount   numeric(14,2) NOT NULL DEFAULT 0,
  pwd_discount      numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (report_id, txn_date, item_name, category, channel)
);

-- PK already leads with report_id, so ON DELETE CASCADE is indexed.
-- Range scans are always (branches, date window).
CREATE INDEX IF NOT EXISTS idx_report_line_totals_branch_date
  ON public.report_line_totals (branch_id, txn_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'report_line_totals_channel_check'
      AND conrelid = 'public.report_line_totals'::regclass
  ) THEN
    ALTER TABLE public.report_line_totals
      ADD CONSTRAINT report_line_totals_channel_check
      CHECK (channel IN ('WALK_IN', 'GRAB', 'FOODPANDA', 'DOTAPP', 'EVENT'));
  END IF;
END $$;

ALTER TABLE public.report_line_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_line_totals_select ON public.report_line_totals;
CREATE POLICY report_line_totals_select ON public.report_line_totals
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

GRANT SELECT ON public.report_line_totals TO authenticated;
GRANT SELECT ON public.report_line_totals TO service_role;

-- 2. Rebuild one report's rollup --------------------------------------------
-- transactionDate arrives as either an ISO string or epoch millis, same as the
-- date-prune branch of reports_daily_compute_slim.

CREATE OR REPLACE FUNCTION public.report_line_totals_rebuild(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET work_mem = '64MB'
AS $$
BEGIN
  DELETE FROM public.report_line_totals WHERE report_id = p_report_id;

  INSERT INTO public.report_line_totals (
    report_id, branch_id, txn_date, item_name, category, channel,
    qty, sales, gross_price, discounted_price,
    regular_discount, senior_discount, pwd_discount
  )
  SELECT
    r.id,
    r.branch_id,
    d.txn_date,
    d.item_name,
    d.category,
    d.channel,
    sum(d.qty),
    sum(d.sales),
    sum(d.gross_price),
    sum(d.discounted_price),
    sum(d.regular_discount),
    sum(d.senior_discount),
    sum(d.pwd_discount)
  FROM public.reports_daily r
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(r.summary_json->'rowDetails', '[]'::jsonb)
  ) AS e
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN jsonb_typeof(e->'transactionDate') = 'string'
          AND (e->>'transactionDate') ~ '^\d{4}-\d{2}-\d{2}'
          THEN left(e->>'transactionDate', 10)::date
        WHEN jsonb_typeof(e->'transactionDate') = 'number'
          THEN (to_timestamp((e->>'transactionDate')::double precision / 1000.0))::date
        ELSE NULL
      END AS txn_date,
      -- Matches `row.mappedItemName ?? row.rawItemName`: JSON null falls
      -- through, empty string does not.
      COALESCE(e->>'mappedItemName', e->>'rawItemName', '') AS item_name,
      e->>'mappedCat' AS category,
      CASE
        WHEN lower(trim(COALESCE(e->>'paymentType',''))) LIKE 'grab%'       THEN 'GRAB'
        WHEN lower(trim(COALESCE(e->>'paymentType',''))) LIKE 'foodpanda%'
          OR lower(trim(COALESCE(e->>'paymentType',''))) LIKE 'food panda%' THEN 'FOODPANDA'
        WHEN lower(trim(COALESCE(e->>'paymentType',''))) LIKE '%dotapp%'
          OR lower(trim(COALESCE(e->>'paymentType',''))) LIKE '%dot app%'
          OR lower(trim(COALESCE(e->>'paymentType',''))) LIKE '%app%'       THEN 'DOTAPP'
        WHEN lower(trim(COALESCE(e->>'paymentType',''))) LIKE '%event%'     THEN 'EVENT'
        ELSE 'WALK_IN'
      END AS channel,
      COALESCE((e->>'quantity')::numeric, 0)         AS qty,
      COALESCE((e->>'rowSales')::numeric, 0)         AS sales,
      COALESCE((e->>'grossPrice')::numeric, 0)       AS gross_price,
      COALESCE((e->>'discountedPrice')::numeric, 0)  AS discounted_price,
      COALESCE((e->>'regularDiscount')::numeric, 0)  AS regular_discount,
      COALESCE((e->>'seniorDiscount')::numeric, 0)   AS senior_discount,
      COALESCE((e->>'pwdDiscount')::numeric, 0)      AS pwd_discount
  ) AS d
  WHERE r.id = p_report_id
    -- getRows() keeps only MAPPED rows with a category and a real date.
    AND e->>'status' = 'MAPPED'
    AND e->>'mappedCat' IS NOT NULL
    AND d.txn_date IS NOT NULL
  GROUP BY r.id, r.branch_id, d.txn_date, d.item_name, d.category, d.channel;
END;
$$;

REVOKE ALL ON FUNCTION public.report_line_totals_rebuild(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_line_totals_rebuild(uuid) TO service_role;

-- 3. Keep it in sync --------------------------------------------------------
-- AFTER trigger: the rollup is derived, so it must see the committed row.

CREATE OR REPLACE FUNCTION public.reports_daily_sync_line_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.report_line_totals_rebuild(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reports_daily_line_totals ON public.reports_daily;

CREATE TRIGGER reports_daily_line_totals
AFTER INSERT OR UPDATE OF summary_json ON public.reports_daily
FOR EACH ROW
EXECUTE FUNCTION public.reports_daily_sync_line_totals();

-- 4. Read path --------------------------------------------------------------
-- One row PER REPORT carrying that report's lines as a jsonb array, rather
-- than one row per line. PostgREST caps a response at db-max-rows (1000 here)
-- and truncates silently, which a 147k-line year would hit; report counts are
-- already bounded by MAX_COMPUTE_RANGE_REPORTS (150) on the client.
--
-- Lines are positional to keep the payload small — repeating six keys 147k
-- times costs more than the data. Decoded in fetchDailyReportsForComputeRollup.
--
--   [ txn_date, item_name, category, payment_type, qty, sales ]
--
-- payment_type is synthesized so the client's getChannelFromPaymentType maps it
-- back to the channel it was derived from.
--
-- jsonb_agg is unordered: compute folds by key and does not need sorted lines.
-- ORDER BY inside the aggregate was ~10s for a full year — over the 8s
-- authenticator statement_timeout. The client also splits spans >31 days
-- into month windows the same way as compute_slim.

DROP FUNCTION IF EXISTS public.reports_daily_rollup(date, date, uuid[]);

CREATE FUNCTION public.reports_daily_rollup(
  p_date_from date,
  p_date_to   date,
  p_branch_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  report_id uuid,
  line_count integer,
  lines jsonb
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public
SET work_mem = '64MB'
AS $$
  SELECT
    t.report_id,
    count(*)::integer AS line_count,
    jsonb_agg(
      jsonb_build_array(
        t.txn_date,
        t.item_name,
        t.category,
        CASE t.channel
          WHEN 'GRAB'      THEN 'grab'
          WHEN 'FOODPANDA' THEN 'foodpanda'
          WHEN 'DOTAPP'    THEN 'dotapp'
          WHEN 'EVENT'     THEN 'event'
          ELSE 'walk-in'
        END,
        t.qty,
        t.sales
      )
    ) AS lines
  FROM public.report_line_totals t
  WHERE t.txn_date BETWEEN p_date_from AND p_date_to
    AND (
      p_branch_ids IS NULL
      OR cardinality(p_branch_ids) = 0
      OR t.branch_id = ANY (p_branch_ids)
    )
  GROUP BY t.report_id;
$$;

GRANT EXECUTE ON FUNCTION public.reports_daily_rollup(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reports_daily_rollup(date, date, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
