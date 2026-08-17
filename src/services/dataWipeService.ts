import { requireAdminUser } from "@/lib/api/authGuards";
import { handleSupabaseError } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EPOCH = "1970-01-01";

export interface WipeOperationalDataResult {
  ledger: number;
  reportsDaily: number;
  reportsMonthly: number;
  auditLogs: number;
}

async function countRows(table: string): Promise<number> {
  const { count, error } = await (supabaseAdmin as any)
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function deleteAllRows(table: string): Promise<number> {
  const total = await countRows(table);
  if (total === 0) return 0;

  const { error } = await (supabaseAdmin as any)
    .from(table)
    .delete()
    .gte("created_at", EPOCH);

  if (error) {
    throw new Error(`Failed to wipe ${table}: ${error.message}`);
  }

  return total;
}

export async function wipeOperationalData(): Promise<WipeOperationalDataResult> {
  try {
    const admin = await requireAdminUser();

    const ledger = await deleteAllRows("daily_ledger_entries");
    const reportsDaily = await deleteAllRows("reports_daily");
    const reportsMonthly = await deleteAllRows("reports_monthly");
    const auditLogs = await deleteAllRows("audit_logs");

    const { error: logError } = await (supabaseAdmin as any).from("audit_logs").insert({
      user_id: admin.userId,
      user_email: admin.email ?? "",
      user_role: admin.role,
      action: "delete_data",
      module: "settings",
      target_type: "operational_data",
      target_name: "operational data wipe",
      details:
        "Wiped daily reports, monthly reports, cash ledger entries, and prior audit logs.",
      metadata: {
        ledger,
        reportsDaily,
        reportsMonthly,
        auditLogs,
      },
    });

    if (logError) {
      console.error("[dataWipeService] Failed to write wipe audit log:", logError.message);
    }

    return { ledger, reportsDaily, reportsMonthly, auditLogs };
  } catch (error) {
    console.error("wipeOperationalData error:", error);
    throw new Error(handleSupabaseError(error));
  }
}
