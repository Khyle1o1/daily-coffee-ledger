# Supabase Integration - Verification Checklist

Use this checklist to verify that the Supabase integration is working correctly.

## ✅ Pre-Flight Checks

### Files Created
- [ ] `src/lib/supabaseClient.ts` exists
- [ ] `src/lib/supabase.types.ts` exists
- [ ] `src/lib/supabase-types.ts` exists
- [ ] `src/services/reportsService.ts` exists
- [ ] `src/services/reportConverter.ts` exists
- [ ] `src/services/monthlyReportService.ts` exists
- [ ] `supabase/migrations/001_initial_schema.sql` exists
- [ ] `supabase/migrations/002_rls_policies.sql` exists
- [ ] `.env.local` exists (you created it)

### Dependencies
- [ ] `@supabase/supabase-js` in package.json
- [ ] Run `npm install` if needed
- [ ] No TypeScript errors: `npm run build`
- [ ] No linter errors: `npm run lint`

## 🗄️ Database Setup

### Supabase Project
- [ ] Supabase account created
- [ ] New project created
- [ ] Project URL copied
- [ ] Anon key copied
- [ ] Credentials in `.env.local`

### Schema Migration
- [ ] Opened SQL Editor in Supabase
- [ ] Ran `001_initial_schema.sql` successfully
- [ ] Ran `002_rls_policies.sql` successfully
- [ ] No SQL errors in output

### Table Verification
Go to Supabase → Table Editor:

**branches table:**
- [ ] Table exists
- [ ] Has 5 rows
- [ ] Row 1: greenbelt | Greenbelt
- [ ] Row 2: podium | Podium
- [ ] Row 3: mind_museum | The Mind Museum
- [ ] Row 4: trinoma | Trinoma
- [ ] Row 5: uptown | Uptown

**reports_daily table:**
- [ ] Table exists
- [ ] Columns: id, branch_id, report_date, date_range_start, date_range_end
- [ ] Columns: transactions_file_name, mapping_file_name
- [ ] Column: summary_json (type: jsonb)
- [ ] Columns: created_at, updated_at

**reports_monthly table:**
- [ ] Table exists
- [ ] Columns: id, branch_id, month_key
- [ ] Columns: date_range_start, date_range_end
- [ ] Column: summary_json (type: jsonb)
- [ ] Columns: created_at, updated_at

### RLS Verification
Go to Supabase → Authentication → Policies:

- [ ] `branches` has RLS enabled
- [ ] `reports_daily` has RLS enabled
- [ ] `reports_monthly` has RLS enabled
- [ ] Public read policies exist (development mode)
- [ ] Public write policies exist (development mode)

## 🚀 Application Testing

### Startup
- [ ] Run `npm run dev`
- [ ] App loads at http://localhost:5173
- [ ] No errors in browser console
- [ ] See toast: "Connected to Supabase"
- [ ] Toast shows: "Loaded 5 branches and X reports"

### Branch Loading
- [ ] Branch dropdown is enabled (not disabled)
- [ ] Dropdown shows 5 branches:
  - [ ] Greenbelt
  - [ ] Podium
  - [ ] The Mind Museum
  - [ ] Trinoma
  - [ ] Uptown
- [ ] Can select a branch

### Daily Report Upload

**First Upload:**
- [ ] Select date (e.g., today)
- [ ] Select branch (e.g., Greenbelt)
- [ ] Upload transactions CSV
- [ ] Upload mapping CSV (optional)
- [ ] Click "Compute"
- [ ] Button shows "Saving..." during save
- [ ] See toast: "Report saved"
- [ ] Toast shows: "Daily report for [branch] on [date] saved successfully"
- [ ] Report appears in left history panel
- [ ] Report is automatically selected/active

**Report Display:**
- [ ] Summary tab shows category totals
- [ ] Details tab shows row-by-row data
- [ ] Unmapped tab shows unmapped items
- [ ] All numbers match expected values

**Persistence Test:**
- [ ] Refresh browser (F5)
- [ ] App reconnects to Supabase
- [ ] Previous report still in history list
- [ ] Can click report to view again
- [ ] All data intact

**Database Verification:**
Go to Supabase → Table Editor → reports_daily:
- [ ] New row exists
- [ ] `branch_id` matches selected branch
- [ ] `report_date` matches selected date
- [ ] `transactions_file_name` shows CSV name
- [ ] `summary_json` contains data (click to expand)
- [ ] JSON has all required fields:
  - [ ] summaryTotalsByCat
  - [ ] summaryQuantitiesByCat
  - [ ] grandTotal
  - [ ] rowDetails
  - [ ] unmappedSummary

**Second Upload (Same Date/Branch):**
- [ ] Upload another CSV for same date/branch
- [ ] Click "Compute"
- [ ] See "Report saved" toast
- [ ] Report is updated (not duplicated)
- [ ] Only one entry in history for that date/branch
- [ ] Database has only one row (check Table Editor)

**Multiple Branches:**
- [ ] Upload report for different branch, same date
- [ ] Both reports show in history
- [ ] Can switch between them
- [ ] Each shows correct branch data

### History Panel
- [ ] Reports grouped by date
- [ ] Date shows total across branches
- [ ] Each branch shows as separate item
- [ ] Active report is highlighted
- [ ] Click any report to switch to it
- [ ] Category chips show on each item

### Monthly Summary

**With Data:**
- [ ] Click "Monthly Summary" tab
- [ ] Select month with uploaded reports
- [ ] Monthly summary displays
- [ ] Shows aggregated totals
- [ ] Shows daily breakdown
- [ ] Shows unmapped items
- [ ] Branch filter works (if multiple branches)

**Without Data:**
- [ ] Select month with no reports
- [ ] Shows "No data for this month" message
- [ ] No errors in console

### Monthly History (Left Panel)
- [ ] Monthly History section appears
- [ ] Shows months with data
- [ ] Click month → switches to Monthly view
- [ ] Shows month name and total
- [ ] Active month is highlighted

### Error Handling

**Missing Branch:**
- [ ] Select date
- [ ] Don't select branch
- [ ] Try to upload CSV
- [ ] See "Select branch first" error
- [ ] CSV not uploaded

**Network Error:**
- [ ] Disconnect internet (or pause Supabase project)
- [ ] Try to compute report
- [ ] See error toast: "Failed to save report"
- [ ] Error message is user-friendly
- [ ] Console shows detailed error

**Invalid CSV:**
- [ ] Upload invalid/corrupt CSV
- [ ] See "Failed to parse CSV file" alert
- [ ] App doesn't crash

### Loading States
- [ ] On initial load, branch dropdown shows "Loading..."
- [ ] During save, Compute button shows "Saving..."
- [ ] Compute button is disabled while saving
- [ ] No duplicate saves possible (button disabled)

### Clear Session
- [ ] Click "Clear Session" button
- [ ] See toast: "Session cleared"
- [ ] Toast mentions: "Reports remain saved in Supabase"
- [ ] UI inputs cleared
- [ ] History list still shows (reports persist)
- [ ] Can still click reports to view

## 🔍 Advanced Testing

### Multiple Dates
- [ ] Upload reports for 5 different dates
- [ ] All appear in history
- [ ] Sorted newest first
- [ ] Can switch between all of them

### Combined View
- [ ] Upload reports for 2+ branches, same date
- [ ] Click one report
- [ ] See "All Branches (This Date)" button
- [ ] Click it
- [ ] Shows combined totals
- [ ] Shows branch breakdown
- [ ] Totals match sum of individual branches

### Data Integrity
Pick a saved report and verify:
- [ ] Grand total matches sum of categories
- [ ] Percentages sum to ~100%
- [ ] Mapped + Unmapped + Skipped = Total rows
- [ ] Row details match summary totals
- [ ] Unmapped summary matches unmapped rows

### Performance
- [ ] Initial load < 3 seconds
- [ ] Report save < 1 second
- [ ] Report switch instant
- [ ] No UI lag/freezing
- [ ] Console shows no warnings

## 🎯 Production Readiness

### Security (Current State)
- [ ] RLS enabled on all tables ✅
- [ ] Public policies for development ✅
- [ ] Production policies documented ✅
- [ ] Auth migration path clear ✅

### Code Quality
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] No console errors in production build
- [ ] All functions typed
- [ ] Error handling comprehensive

### Documentation
- [ ] QUICK_START.md read and followed
- [ ] SUPABASE_SETUP.md available
- [ ] README_SUPABASE.md available
- [ ] IMPLEMENTATION_SUMMARY.md available
- [ ] SQL migrations documented

## 🎉 Final Verification

If all boxes are checked:

✅ **Supabase integration is working correctly!**

You can now:
1. Use the app in production (with development policies)
2. Deploy to hosting (remember to add .env variables)
3. Share with team members
4. Prepare for authentication migration

### Before Production Deployment:
1. Implement Supabase Auth
2. Update RLS policies
3. Add user_id columns
4. Test with multiple users

## 📊 Test Results

**Date Tested:** _________________

**Tested By:** _________________

**All Checks Passed:** YES / NO

**Issues Found:**
- 
- 
- 

**Notes:**
- 
- 
- 

---

**Sign-off:** This integration is ready for _____________ (development/staging/production)
