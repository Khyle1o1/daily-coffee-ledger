# Quick Start Guide - Supabase Integration

## 🚀 Get Running in 5 Minutes

### Step 1: Create Supabase Project (2 min)
1. Go to https://app.supabase.com
2. Click "New Project"
3. Name: "DOT Coffee"
4. Password: (choose and save)
5. Region: (closest to you)
6. Click "Create new project"
7. Wait ~2 minutes

### Step 2: Get Credentials (1 min)
1. In Supabase dashboard → Settings → API
2. Copy **Project URL**
3. Copy **anon public key**

### Step 3: Configure App (30 sec)
1. Create `.env.local` in project root:
```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
```
2. Replace with your actual values

### Step 4: Setup Database (1 min)
1. In Supabase dashboard → SQL Editor
2. Click "New Query"
3. Copy entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click "Run"
5. Create another new query
6. Copy entire contents of `supabase/migrations/002_rls_policies.sql`
7. Paste and click "Run"

### Step 5: Verify (30 sec)
1. In Supabase dashboard → Table Editor
2. You should see:
   - ✅ `branches` table (5 rows)
   - ✅ `reports_daily` table (empty)
   - ✅ `reports_monthly` table (empty)

### Step 6: Start App (30 sec)
```bash
npm run dev
```

### Step 7: Test (1 min)
1. App opens at http://localhost:5173
2. You see toast: "Connected to Supabase"
3. Branch dropdown shows 5 branches
4. No errors in console

## ✅ Success!

Your app is now connected to Supabase!

Try uploading a report:
1. Select a date
2. Select a branch
3. Upload your CSV
4. Click "Compute"
5. See "Report saved" toast
6. Refresh page → report still there!

## 🔧 Troubleshooting

**"Missing Supabase environment variables"**
- Check `.env.local` exists in root folder
- Check variable names: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server

**"Failed to fetch branches"**
- Check Supabase project is not paused
- Verify migrations ran successfully
- Check browser console for details

**Tables not showing up**
- Re-run the SQL migrations
- Check for SQL errors in Supabase logs

**Need more help?**
- See `SUPABASE_SETUP.md` for detailed guide
- See `README_SUPABASE.md` for technical docs
- Check browser console for errors
- Check Supabase dashboard → Logs

## 📚 Next Steps

1. ✅ Upload your first report
2. ✅ Test monthly summary
3. 📖 Read `README_SUPABASE.md` for features
4. 🚀 Deploy to production (add auth first!)

---

**That's it!** You're ready to use Supabase with your DOT Coffee app.
