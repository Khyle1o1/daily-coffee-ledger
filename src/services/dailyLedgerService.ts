import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type { Branch } from '@/lib/supabase-types';

export type DailyLedgerSource = 'sheet' | 'pos_derived' | 'pos_partial';

export interface DailyLedgerAmounts {
  cash: number;
  maya: number;
  grab: number;
  paymongo: number;
  gcash: number;
  foodpanda: number;
  giftCard: number;
  regularDiscount: number;
  seniorDiscount: number;
  pwdDiscount: number;
  vatExemption: number;
  grossSalesNet: number;
  transactionCount: number;
  grossSales: number;
}

export interface DailyLedgerEntry extends DailyLedgerAmounts {
  id: string;
  branchId: string;
  ledgerDate: string; // YYYY-MM-DD
  source: DailyLedgerSource;
  sourceFileName: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: Branch | null;
}

export interface UpsertDailyLedgerPayload extends DailyLedgerAmounts {
  branchId: string;
  ledgerDate: string;
  source: DailyLedgerSource;
  sourceFileName?: string | null;
}

type DbRow = {
  id: string;
  branch_id: string;
  ledger_date: string;
  cash: number | string;
  maya: number | string;
  grab: number | string;
  paymongo: number | string;
  gcash: number | string;
  foodpanda: number | string;
  gift_card: number | string;
  regular_discount: number | string;
  senior_discount: number | string;
  pwd_discount: number | string;
  vat_exemption: number | string;
  gross_sales_net: number | string;
  transaction_count: number | string;
  gross_sales: number | string;
  source: DailyLedgerSource;
  source_file_name: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch | null;
};

function n(v: number | string | null | undefined): number {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(x) ? x : 0;
}

function fromRow(row: DbRow): DailyLedgerEntry {
  return {
    id: row.id,
    branchId: row.branch_id,
    ledgerDate: row.ledger_date,
    cash: n(row.cash),
    maya: n(row.maya),
    grab: n(row.grab),
    paymongo: n(row.paymongo),
    gcash: n(row.gcash),
    foodpanda: n(row.foodpanda),
    giftCard: n(row.gift_card),
    regularDiscount: n(row.regular_discount),
    seniorDiscount: n(row.senior_discount),
    pwdDiscount: n(row.pwd_discount),
    vatExemption: n(row.vat_exemption),
    grossSalesNet: n(row.gross_sales_net),
    transactionCount: Math.round(n(row.transaction_count)),
    grossSales: n(row.gross_sales),
    source: row.source,
    sourceFileName: row.source_file_name,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    branch: row.branch ?? null,
  };
}

function toDbPayload(p: UpsertDailyLedgerPayload, userId: string) {
  return {
    branch_id: p.branchId,
    ledger_date: p.ledgerDate,
    cash: p.cash,
    maya: p.maya,
    grab: p.grab,
    paymongo: p.paymongo,
    gcash: p.gcash,
    foodpanda: p.foodpanda,
    gift_card: p.giftCard,
    regular_discount: p.regularDiscount,
    senior_discount: p.seniorDiscount,
    pwd_discount: p.pwdDiscount,
    vat_exemption: p.vatExemption,
    gross_sales_net: p.grossSalesNet,
    transaction_count: p.transactionCount,
    gross_sales: p.grossSales,
    source: p.source,
    source_file_name: p.sourceFileName ?? null,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
}

export function emptyLedgerAmounts(): DailyLedgerAmounts {
  return {
    cash: 0,
    maya: 0,
    grab: 0,
    paymongo: 0,
    gcash: 0,
    foodpanda: 0,
    giftCard: 0,
    regularDiscount: 0,
    seniorDiscount: 0,
    pwdDiscount: 0,
    vatExemption: 0,
    grossSalesNet: 0,
    transactionCount: 0,
    grossSales: 0,
  };
}

/** Regular + Senior + PWD. VAT exemption is not a discount. */
export function ledgerDiscountTotal(
  a: Pick<DailyLedgerAmounts, "regularDiscount" | "seniorDiscount" | "pwdDiscount">,
): number {
  return a.regularDiscount + a.seniorDiscount + a.pwdDiscount;
}

/** Gross sales with discounts removed. Gross Net stays equal to GROSS SALES. */
export function ledgerNetSales(
  a: Pick<DailyLedgerAmounts, "grossSales" | "regularDiscount" | "seniorDiscount" | "pwdDiscount">,
): number {
  return Math.max(0, a.grossSales - ledgerDiscountTotal(a));
}

export async function upsertDailyLedgerEntries(
  payloads: UpsertDailyLedgerPayload[],
): Promise<DailyLedgerEntry[]> {
  if (payloads.length === 0) return [];

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    const rows = payloads.map((p) => toDbPayload(p, user.id));

    const { data, error } = await (supabase as any)
      .from('daily_ledger_entries')
      .upsert(rows, { onConflict: 'branch_id,ledger_date' })
      .select(
        'id, branch_id, ledger_date, cash, maya, grab, paymongo, gcash, foodpanda, gift_card, ' +
          'regular_discount, senior_discount, pwd_discount, vat_exemption, gross_sales_net, ' +
          'transaction_count, gross_sales, source, source_file_name, user_id, created_at, updated_at, ' +
          'branch:branches(id, name, label, created_at, updated_at)',
      );

    if (error) throw new Error(`Failed to upsert daily ledger: ${error.message}`);
    return ((data as DbRow[]) ?? []).map(fromRow);
  } catch (error) {
    console.error('upsertDailyLedgerEntries error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

export async function listDailyLedgerEntries(params: {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}): Promise<DailyLedgerEntry[]> {
  try {
    let query = (supabase as any)
      .from('daily_ledger_entries')
      .select(
        'id, branch_id, ledger_date, cash, maya, grab, paymongo, gcash, foodpanda, gift_card, ' +
          'regular_discount, senior_discount, pwd_discount, vat_exemption, gross_sales_net, ' +
          'transaction_count, gross_sales, source, source_file_name, user_id, created_at, updated_at, ' +
          'branch:branches(id, name, label, created_at, updated_at)',
      )
      .order('ledger_date', { ascending: true })
      .order('branch_id', { ascending: true })
      .limit(5000);

    if (params.dateFrom) query = query.gte('ledger_date', params.dateFrom);
    if (params.dateTo) query = query.lte('ledger_date', params.dateTo);
    if (params.branchId) query = query.eq('branch_id', params.branchId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list daily ledger: ${error.message}`);
    return ((data as DbRow[]) ?? []).map(fromRow);
  } catch (error) {
    console.error('listDailyLedgerEntries error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

export async function deleteDailyLedgerEntry(id: string): Promise<void> {
  try {
    const { error } = await (supabase as any)
      .from('daily_ledger_entries')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Failed to delete daily ledger entry: ${error.message}`);
  } catch (error) {
    console.error('deleteDailyLedgerEntry error:', error);
    throw new Error(handleSupabaseError(error));
  }
}
