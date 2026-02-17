# Supabase Integration - Quick Reference

## Overview

This application now uses Supabase (PostgreSQL) for persistent data storage instead of localStorage.

## What Changed?

### Before (localStorage)
- Reports stored in browser only
- Data lost when clearing browser cache
- No cross-device access
- No real database queries

### After (Supabase)
- Reports stored in PostgreSQL database
- Data persists across sessions and devices
- Full database query capabilities
- Real-time sync potential (future)

## Key Files

### Configuration
- `src/lib/supabaseClient.ts` - Supabase client initialization
- `src/lib/supabase.types.ts` - TypeScript types for database schema
- `src/lib/supabase-types.ts` - Application-specific types
- `.env.local` - Environment variables (create this yourself!)

### Services
- `src/services/reportsService.ts` - All database operations
- `src/services/reportConverter.ts` - Convert between app and DB types

### Database
- `supabase/migrations/001_initial_schema.sql` - Tables, indexes, triggers
- `supabase/migrations/002_rls_policies.sql` - Row Level Security policies

## Data Flow

### Saving a Report
```
User clicks "Compute" 
  → Compute summary locally
  → Convert to DailySummaryJSON
  → Save to Supabase (saveDailyReport)
  → Update local state with saved report ID
  → Show toast notification
```

### Loading Reports on App Start
```
App mounts
  → Fetch branches (getBranches)
  → Seed if empty (seedBranchesIfEmpty)
  → Fetch all reports (listAllDailyReports)
  → Convert to app format
  → Update local state
  → Show toast notification
```

## Database Schema

### branches
```sql
id              uuid (PK)
name            text (unique) - 'greenbelt', 'podium', etc.
label           text - 'Greenbelt', 'Podium', etc.
created_at      timestamptz
updated_at      timestamptz
```

### reports_daily
```sql
id                      uuid (PK)
branch_id               uuid (FK → branches)
report_date             date
date_range_start        date
date_range_end          date
transactions_file_name  text
mapping_file_name       text
summary_json            jsonb - All computed data
created_at              timestamptz
updated_at              timestamptz

UNIQUE (branch_id, report_date)
```

### reports_monthly
```sql
id                uuid (PK)
branch_id         uuid (FK → branches) - nullable for "all branches"
month_key         text - Format: "YYYY-MM"
date_range_start  date
date_range_end    date
summary_json      jsonb - Aggregated monthly data
created_at        timestamptz
updated_at        timestamptz

UNIQUE (branch_id, month_key)
```

## JSON Structure

### DailySummaryJSON
Stored in `reports_daily.summary_json`:
```typescript
{
  summaryTotalsByCat: Record<Category, number>,
  summaryQuantitiesByCat: Record<Category, number>,
  grandTotal: number,
  grandQuantity: number,
  percentByCat: Record<Category, number>,
  totalRows: number,
  mappedRows: number,
  unmappedRows: number,
  skippedRows: number,
  rowDetails: ProcessedRow[],
  unmappedSummary: UnmappedSummary[],
  filename: string,
  uploadedAt: number
}
```

### MonthlySummaryJSON
Stored in `reports_monthly.summary_json`:
```typescript
{
  displayMonth: string,
  summaryTotalsByCat: Record<Category, number>,
  summaryQuantitiesByCat: Record<Category, number>,
  grandTotal: number,
  grandQuantity: number,
  percentByCat: Record<Category, number>,
  totalRows: number,
  mappedRows: number,
  unmappedRows: number,
  skippedRows: number,
  totalFiles: number,
  branchBreakdown: Array<{...}>,
  dailyBreakdown: Array<{...}>,
  unmappedSummary: UnmappedSummary[]
}
```

## API Functions

### Branch Operations
```typescript
getBranches() → Branch[]
getBranchByName(name: BranchId) → Branch | null
seedBranchesIfEmpty() → void
```

### Daily Report Operations
```typescript
saveDailyReport(payload) → DailyReportRow
listDailyReports(branchId, start?, end?) → DailyReportRow[]
listAllDailyReports(start?, end?) → DailyReportRow[]
getDailyReport(id) → DailyReportRow | null
deleteDailyReport(id) → void
```

### Monthly Report Operations
```typescript
saveMonthlyReport(payload) → MonthlyReportRow
listMonthlyReports(branchId, monthStart?, monthEnd?) → MonthlyReportRow[]
getMonthlyReport(id) → MonthlyReportRow | null
deleteMonthlyReport(id) → void
```

## Security

### Current Setup (Development)
- RLS enabled on all tables
- Public read/write policies (for development only)
- No authentication required

### Production TODO
1. Implement Supabase Auth
2. Add `user_id` columns to reports tables
3. Replace public policies with authenticated policies
4. Enforce user ownership in queries

## Common Operations

### Adding a New Category
1. Update `CATEGORIES` in `src/utils/types.ts`
2. Update `Category` type
3. No database migration needed (JSONB is flexible)

### Adding a New Branch
1. Add to `BRANCHES` in `src/utils/types.ts`
2. Add to seed data in `001_initial_schema.sql`
3. Update `branches` table CHECK constraint

### Querying Reports
```typescript
// Get all reports for a branch
const reports = await listDailyReports(branchUuid);

// Get reports in date range
const reports = await listDailyReports(
  branchUuid, 
  '2026-02-01', 
  '2026-02-28'
);

// Get single report
const report = await getDailyReport(reportId);
```

## Error Handling

All service functions:
- Throw errors on failure
- Log to console
- Return user-friendly error messages
- Use `handleSupabaseError()` helper

UI handles errors by:
- Showing toast notifications
- Maintaining loading states
- Disabling actions during operations

## Testing

1. **Connection Test**: App shows toast on successful connection
2. **Branch Loading**: Check console for "✅ Branches seeded"
3. **Report Saving**: Watch for "Report saved" toast
4. **Report Loading**: Verify reports persist after page refresh

## Debugging

### Browser Console
```javascript
// Check Supabase client
console.log(supabase);

// Test connection
await supabase.from('branches').select('*');
```

### Supabase Dashboard
1. **Table Editor**: View raw data
2. **SQL Editor**: Run custom queries
3. **Logs**: View database activity
4. **API**: Test endpoints

## Performance

- Indexes on all common query columns
- JSONB GIN indexes for flexible queries
- Upsert operations prevent duplicates
- Batch loading on app start

## Future Enhancements

- [ ] Real-time subscriptions for multi-user updates
- [ ] Monthly report auto-generation on schedule
- [ ] Export reports to PDF/Excel from Supabase
- [ ] Authentication with user accounts
- [ ] Role-based access control
- [ ] Audit logs for data changes
- [ ] Data backups and archiving
