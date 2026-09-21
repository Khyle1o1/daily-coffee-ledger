-- 030_report_line_totals_local_dates.sql
--
-- Fix HQ Sync under-counting vs Monthly Branch.
--
-- Uploads store transactionDate as a JS Date at local midnight (Asia/Manila).
-- JSON round-trip serializes that as UTC ISO (e.g. Aug 1 00:00 +08 →
-- 2026-07-31T16:00:00.000Z). The old rebuild used left(iso, 10)::date, so
-- every PH local day was stored as the previous UTC calendar day. Filtering
-- HQ reports by month then dropped the first local day (exact ₱26,121 gap on
-- Greenbelt Aug 2026 = local Aug 1).
--
-- Parse timestamptz into Asia/Manila calendar dates instead. Date-only strings
-- (YYYY-MM-DD) stay as-is.

CREATE OR REPLACE FUNCTION public.report_txn_local_date(raw jsonb)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR raw = 'null'::jsonb THEN NULL
    -- Already a calendar date with no time component.
    WHEN jsonb_typeof(raw) = 'string'
      AND (raw #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (raw #>> '{}')::date
    -- ISO / timestamptz string → Philippines wall-clock date.
    WHEN jsonb_typeof(raw) = 'string'
      AND (raw #>> '{}') ~ '^\d{4}-\d{2}-\d{2}'
      THEN ((raw #>> '{}')::timestamptz AT TIME ZONE 'Asia/Manila')::date
    -- Epoch milliseconds.
    WHEN jsonb_typeof(raw) = 'number'
      THEN (
        to_timestamp((raw #>> '{}')::double precision / 1000.0)
        AT TIME ZONE 'Asia/Manila'
      )::date
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.report_txn_local_date(jsonb) IS
  'Calendar date in Asia/Manila for a rowDetails transactionDate JSON value.';

CREATE OR REPLACE FUNCTION public.report_line_totals_rebuild(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET work_mem = '64MB'
AS $$
DECLARE
  _n integer;
BEGIN
  DELETE FROM public.report_line_totals WHERE report_id = p_report_id;
  DELETE FROM public.report_day_ledger WHERE report_id = p_report_id;

  WITH elems AS (
    SELECT
      r.id AS report_id,
      r.branch_id,
      e.elem,
      e.ord
    FROM public.reports_daily r
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(r.summary_json->'rowDetails', '[]'::jsonb)
    ) WITH ORDINALITY AS e(elem, ord)
    WHERE r.id = p_report_id
  ),
  parsed AS (
    SELECT
      x.report_id,
      x.branch_id,
      x.ord,
      x.elem->>'status' AS status,
      d.txn_date,
      d.item_name,
      d.category,
      d.channel,
      d.qty,
      d.sales,
      d.gross_price,
      d.discounted_price,
      d.line_amt,
      d.tender,
      d.reg_explicit,
      d.sen_explicit,
      d.pwd_explicit,
      d.implied,
      d.line_kind,
      d.vat,
      d.txn_id,
      d.enriched
    FROM elems x
    CROSS JOIN LATERAL (
      SELECT
        public.report_txn_local_date(x.elem->'transactionDate') AS txn_date,
        COALESCE(x.elem->>'mappedItemName', x.elem->>'rawItemName', '') AS item_name,
        x.elem->>'mappedCat' AS category,
        CASE
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE 'grab%'       THEN 'GRAB'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE 'foodpanda%'
            OR lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE 'food panda%' THEN 'FOODPANDA'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%dotapp%'
            OR lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%dot app%'
            OR lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%app%'       THEN 'DOTAPP'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%event%'     THEN 'EVENT'
          ELSE 'WALK_IN'
        END AS channel,
        COALESCE((x.elem->>'quantity')::numeric, 0) AS qty,
        COALESCE((x.elem->>'rowSales')::numeric, 0) AS sales,
        COALESCE((x.elem->>'grossPrice')::numeric, 0) AS gross_price,
        COALESCE((x.elem->>'discountedPrice')::numeric, 0) AS discounted_price,
        CASE
          WHEN jsonb_typeof(x.elem->'discountedPrice') = 'number'
            THEN (x.elem->>'discountedPrice')::numeric
          ELSE COALESCE((x.elem->>'rowSales')::numeric, 0)
        END AS line_amt,
        CASE
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%gift%' THEN 'giftCard'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%foodpanda%'
            OR lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%food panda%' THEN 'foodpanda'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE 'grab%' THEN 'grab'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%paymongo%' THEN 'paymongo'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%gcash%'
            OR lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%g-cash%'
            OR lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%g cash%' THEN 'gcash'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%maya%' THEN 'maya'
          WHEN lower(trim(COALESCE(x.elem->>'paymentType',''))) LIKE '%cash%' THEN 'cash'
          ELSE 'other'
        END AS tender,
        COALESCE((x.elem->>'regularDiscount')::numeric, 0) AS reg_explicit,
        COALESCE((x.elem->>'seniorDiscount')::numeric, 0) AS sen_explicit,
        COALESCE((x.elem->>'pwdDiscount')::numeric, 0) AS pwd_explicit,
        CASE
          WHEN COALESCE((x.elem->>'grossPrice')::numeric, 0) > 0
            AND COALESCE((x.elem->>'discountedPrice')::numeric, 0) > 0
            AND COALESCE((x.elem->>'grossPrice')::numeric, 0)
              > COALESCE((x.elem->>'discountedPrice')::numeric, 0) + 0.005
            THEN COALESCE((x.elem->>'grossPrice')::numeric, 0)
               - COALESCE((x.elem->>'discountedPrice')::numeric, 0)
          WHEN COALESCE((x.elem->>'itemDiscountAmount')::numeric, 0)
             + COALESCE((x.elem->>'totalDiscountAmount')::numeric, 0) > 0.005
            THEN COALESCE((x.elem->>'itemDiscountAmount')::numeric, 0)
               + COALESCE((x.elem->>'totalDiscountAmount')::numeric, 0)
          ELSE COALESCE((x.elem->>'regularDiscount')::numeric, 0)
             + COALESCE((x.elem->>'seniorDiscount')::numeric, 0)
             + COALESCE((x.elem->>'pwdDiscount')::numeric, 0)
        END AS implied,
        CASE
          WHEN COALESCE((x.elem->>'pwdDiscount')::numeric, 0) > 0.005 THEN 'pwd'
          WHEN COALESCE((x.elem->>'seniorDiscount')::numeric, 0) > 0.005 THEN 'senior'
          WHEN COALESCE((x.elem->>'regularDiscount')::numeric, 0) > 0.005 THEN 'regular'
          WHEN lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) ~ '\ypwd\y'
            OR lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%person with%'
            THEN 'pwd'
          WHEN lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%senior%'
            THEN 'senior'
          WHEN lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%regular%'
            OR lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%promo%'
            OR lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%employee%'
            OR lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%naac%'
            OR lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%solo parent%'
            OR lower(trim(COALESCE(x.elem->>'itemDiscountType', x.elem->>'totalDiscountType', ''))) LIKE '%diplomat%'
            THEN 'regular'
          ELSE NULL
        END AS line_kind,
        COALESCE((x.elem->>'vatExemption')::numeric, 0) AS vat,
        COALESCE(
          NULLIF(trim(x.elem->>'transactionId'), ''),
          NULLIF(trim(x.elem->>'receiptNo'), '')
        ) AS txn_id,
        (
          x.elem ? 'transactionId'
          OR x.elem ? 'discountedPrice'
          OR x.elem ? 'grossPrice'
          OR x.elem ? 'regularDiscount'
          OR x.elem ? 'seniorDiscount'
          OR x.elem ? 'pwdDiscount'
          OR x.elem ? 'vatExemption'
          OR x.elem ? 'itemDiscountType'
          OR x.elem ? 'totalDiscountType'
          OR x.elem ? 'itemDiscountAmount'
          OR x.elem ? 'totalDiscountAmount'
        ) AS enriched
    ) d
    WHERE d.txn_date IS NOT NULL
  ),
  txn_kinds AS (
    SELECT
      report_id,
      txn_id,
      (array_agg(line_kind ORDER BY ord) FILTER (WHERE line_kind IS NOT NULL))[1] AS inherited_kind
    FROM parsed
    WHERE txn_id IS NOT NULL
    GROUP BY report_id, txn_id
  ),
  classified AS (
    SELECT
      p.*,
      CASE
        WHEN p.reg_explicit + p.sen_explicit + p.pwd_explicit > 0.005 THEN p.reg_explicit
        WHEN p.implied > 0.005 AND COALESCE(
          p.line_kind,
          k.inherited_kind,
          CASE WHEN p.vat > 0.005 THEN 'pwd' WHEN p.implied > 0.005 THEN 'regular' END
        ) = 'regular' THEN p.implied
        ELSE 0
      END AS reg_out,
      CASE
        WHEN p.reg_explicit + p.sen_explicit + p.pwd_explicit > 0.005 THEN p.sen_explicit
        WHEN p.implied > 0.005 AND COALESCE(
          p.line_kind,
          k.inherited_kind,
          CASE WHEN p.vat > 0.005 THEN 'pwd' WHEN p.implied > 0.005 THEN 'regular' END
        ) = 'senior' THEN p.implied
        ELSE 0
      END AS sen_out,
      CASE
        WHEN p.reg_explicit + p.sen_explicit + p.pwd_explicit > 0.005 THEN p.pwd_explicit
        WHEN p.implied > 0.005 AND COALESCE(
          p.line_kind,
          k.inherited_kind,
          CASE WHEN p.vat > 0.005 THEN 'pwd' WHEN p.implied > 0.005 THEN 'regular' END
        ) IS DISTINCT FROM 'regular'
          AND COALESCE(
            p.line_kind,
            k.inherited_kind,
            CASE WHEN p.vat > 0.005 THEN 'pwd' WHEN p.implied > 0.005 THEN 'regular' END
          ) IS DISTINCT FROM 'senior'
          THEN p.implied
        ELSE 0
      END AS pwd_out
    FROM parsed p
    LEFT JOIN txn_kinds k
      ON k.report_id = p.report_id AND k.txn_id = p.txn_id
  ),
  ins_lines AS (
    INSERT INTO public.report_line_totals (
      report_id, branch_id, txn_date, item_name, category, channel,
      qty, sales, gross_price, discounted_price,
      regular_discount, senior_discount, pwd_discount
    )
    SELECT
      report_id,
      branch_id,
      txn_date,
      item_name,
      category,
      channel,
      sum(qty),
      sum(sales),
      sum(gross_price),
      sum(discounted_price),
      sum(reg_explicit),
      sum(sen_explicit),
      sum(pwd_explicit)
    FROM classified
    WHERE status = 'MAPPED'
      AND category IS NOT NULL
      AND txn_date IS NOT NULL
    GROUP BY report_id, branch_id, txn_date, item_name, category, channel
    RETURNING report_id
  ),
  ins_days AS (
    INSERT INTO public.report_day_ledger (
      report_id, branch_id, txn_date,
      cash, maya, grab, paymongo, gcash, foodpanda, gift_card,
      regular_discount, senior_discount, pwd_discount, vat_exemption,
      txn_count, enriched
    )
    SELECT
      report_id,
      branch_id,
      txn_date,
      COALESCE(sum(line_amt) FILTER (WHERE tender IN ('cash', 'other')), 0),
      COALESCE(sum(line_amt) FILTER (WHERE tender = 'maya'), 0),
      COALESCE(sum(line_amt) FILTER (WHERE tender = 'grab'), 0),
      COALESCE(sum(line_amt) FILTER (WHERE tender = 'paymongo'), 0),
      COALESCE(sum(line_amt) FILTER (WHERE tender = 'gcash'), 0),
      COALESCE(sum(line_amt) FILTER (WHERE tender = 'foodpanda'), 0),
      COALESCE(sum(line_amt) FILTER (WHERE tender = 'giftCard'), 0),
      COALESCE(sum(reg_out), 0),
      COALESCE(sum(sen_out), 0),
      COALESCE(sum(pwd_out), 0),
      COALESCE(sum(vat), 0),
      count(DISTINCT COALESCE(txn_id, ord::text))::integer,
      COALESCE(bool_or(enriched), false)
    FROM classified
    WHERE txn_date IS NOT NULL
    GROUP BY report_id, branch_id, txn_date
    RETURNING report_id
  )
  SELECT (SELECT count(*) FROM ins_lines) + (SELECT count(*) FROM ins_days)
  INTO _n;
END;
$$;

REVOKE ALL ON FUNCTION public.report_line_totals_rebuild(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_line_totals_rebuild(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.report_txn_local_date(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_txn_local_date(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Rebuild existing rollups with:
--   node scripts/rebuild-report-line-totals.mjs
