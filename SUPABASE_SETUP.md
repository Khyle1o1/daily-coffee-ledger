# Supabase Integration Setup Guide

This guide will help you set up Supabase for the DOT Coffee Daily Summary application.

## Prerequisites

- Node.js and npm installed
- A Supabase account (sign up at [supabase.com](https://supabase.com))

## Step 1: Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in your project details:
   - **Name**: DOT Coffee Daily Summary
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your location
4. Wait for the project to be created (1-2 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Find and copy these values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## Step 3: Configure Environment Variables

1. Create a `.env.local` file in the root of your project:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. Replace the placeholder values with your actual Supabase credentials from Step 2

## Step 4: Run Database Migrations

You have two options to set up your database:

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `supabase/migrations/001_initial_schema.sql`
5. Paste into the SQL Editor and click **Run**
6. Create another new query
7. Copy the contents of `supabase/migrations/002_rls_policies.sql`
8. Paste and click **Run**

### Option B: Using Supabase CLI

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Link your project:
```bash
supabase link --project-ref your-project-ref
```

3. Push migrations:
```bash
supabase db push
```

## Step 5: Verify Setup

1. In your Supabase dashboard, go to **Table Editor**
2. You should see three tables:
   - `branches` (should have 5 rows with the branch names)
   - `reports_daily`
   - `reports_monthly`

## Step 6: Start Your Application

```bash
npm run dev
```

The app should now connect to Supabase automatically!

## Troubleshooting

### "Missing Supabase environment variables" Error

- Make sure `.env.local` exists in the root directory
- Check that variable names are exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart your dev server after creating/updating `.env.local`

### "Failed to fetch branches" Error

- Verify your Supabase project is active (not paused)
- Check that migrations ran successfully
- Verify RLS policies are enabled
- Check the browser console for detailed error messages

### Connection Test Failed

1. Open your browser console (F12)
2. Look for Supabase connection errors
3. Verify your API URL and key are correct
4. Check if your Supabase project is paused (free tier projects pause after inactivity)

## Security Notes

### Development Mode (Current Setup)

The current RLS policies allow **public read/write access** for development purposes. This is fine for local development but **NOT suitable for production**.

### For Production

Before deploying to production:

1. Implement authentication (Supabase Auth)
2. Replace the public RLS policies with authenticated policies (see comments in `002_rls_policies.sql`)
3. Add `user_id` columns to track ownership
4. Update the frontend to handle authentication

## Database Schema Overview

### Tables

#### `branches`
Stores the 5 coffee shop branches (Greenbelt, Podium, etc.)

#### `reports_daily`
Stores daily reports with computed summary data:
- Branch reference
- Report date
- Date range (start/end)
- File names (transactions, mapping)
- Complete summary data as JSONB

#### `reports_monthly`
Stores monthly aggregated reports:
- Branch reference (or null for "all branches")
- Month key (YYYY-MM format)
- Date range
- Aggregated summary data as JSONB

### Indexes

All tables have appropriate indexes for:
- Fast lookups by date
- Fast lookups by branch
- Fast sorting by created_at
- JSONB queries (GIN indexes)

## Next Steps

1. Test uploading a CSV and generating a report
2. Verify the report is saved to Supabase (check Table Editor)
3. Refresh the page and verify reports are loaded from Supabase
4. Test the monthly aggregation feature

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the Supabase logs (Dashboard → Logs)
3. Verify all migrations ran successfully
4. Ensure your Supabase project is active

---

**Note**: The `.env.local` file is gitignored for security. Each developer needs to create their own `.env.local` file with their Supabase credentials.
