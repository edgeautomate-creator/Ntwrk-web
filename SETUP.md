# First-Time Setup Guide

## Quick Start (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Create Your First Admin User

1. Go to http://localhost:3000
2. You'll be redirected to `/login`
3. Create a new account with your email and password

### Step 4: Set Up Your Organization in Supabase

After signing up, you need to link your user to an organization:

1. **Go to Supabase Dashboard:**
   - Open https://supabase.com/dashboard
   - Select your project: `pqxwytizrqoytbpiudae`
   - Click "SQL Editor" in the left menu

2. **Find Your User ID:**
   ```sql
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
   ```
   Copy your `id` value

3. **Create Organization & Link Your User:**
   ```sql
   -- Create organization
   INSERT INTO organizations (name, slug, subscription_tier, subscription_status, max_leagues, max_players, features)
   VALUES (
     'My Pickleball League',
     'my-league',
     'pro',
     'active',
     999,
     999,
     '{"dupr_integration": true, "advanced_analytics": true, "tournament_mode": true}'::jsonb
   )
   RETURNING id;
   ```
   Copy the returned `id` (this is your organization_id)

4. **Link User to Organization:**
   ```sql
   -- Replace YOUR_ORG_ID and YOUR_USER_ID with values from above
   INSERT INTO organization_users (organization_id, user_id, role, email, full_name)
   VALUES (
     'YOUR_ORG_ID',    -- Paste organization id here
     'YOUR_USER_ID',   -- Paste user id here
     'super_admin',
     'your@email.com', -- Your email
     'Your Name'
   );
   ```

5. **Refresh the app** - You should now see the dashboard!

---

## Step 5: Start Using the App

Now you can:

1. **Create a League:**
   - Go to "Leagues" in the sidebar
   - Click "+ Create League"
   - Enter name and configure scoring rules

2. **Create a Season:**
   - Go to "Seasons"
   - Click "+ Create Season"
   - Select your league and set dates

3. **Create a Division:**
   - Go to "Divisions"
   - Click "+ Create Division"
   - Select season and configure

4. **Add Players:**
   - Go to "Players"
   - Either add individually or import via CSV
   - CSV format: `name,email,phone,dupr_id,dupr_rating`

5. **Create Matches:**
   - Go to "Matches"
   - Click "+ Create Match"
   - Select division and 4 players
   - Enter scores

6. **View Analytics:**
   - Go to "Standings" to see live rankings
   - Go to "Player Analytics" for detailed stats

---

## DUPR Integration (Optional)

To enable DUPR submission:

1. Go to "DUPR Integration" in the sidebar
2. Click "Configure DUPR Credentials"
3. Enter your DUPR credentials:
   ```
   Organization: DinkHeads
   API Key: 5716634764
   API Secret: test-cs-8f3a3a1740114165fa16db499b4dc31d
   Club ID: test-ck-0a9d3935-1a00-46be-fbf9-6376d4af637c
   ```
4. Click "Save Credentials"

Now approved matches will be queued for DUPR submission!

---

## Troubleshooting

**Can't see dashboard after login?**
- Make sure you completed Step 4 (linking user to organization)
- Check Supabase logs for RLS errors

**Getting "Invalid supabaseUrl" error?**
- Verify `.env` file has correct credentials
- Restart the dev server after changing .env

**Database errors?**
- All migrations should be already applied
- Check Supabase → Database → Tables to verify schema exists

---

## Production Deployment

Ready to deploy? See `README.md` for Vercel deployment instructions.
