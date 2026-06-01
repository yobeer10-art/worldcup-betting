# Admin Panel + Auto-Results Setup Guide

## Step 1 — Run the SQL migrations

In Supabase Dashboard → SQL Editor, run these files **in order**:

1. `schema.sql`
2. `schema_groups.sql`
3. `schema_admin.sql`  ← new

`schema_admin.sql` adds:
- `admins` table (seeds `yobeer10@gmail.com` automatically)
- `is_locked` and `last_synced_at` columns on `matches`
- `is_banned` column on `users`
- `sync_log` table for tracking auto-sync runs
- All admin RPC functions (`set_match_result`, `admin_*`)

---

## Step 2 — Add more admins (optional)

```sql
INSERT INTO public.admins (email) VALUES ('another@email.com');
```

---

## Step 3 — Get a free football-data.org API key

1. Go to **https://www.football-data.org/client/register**
2. Register a free account
3. Copy your **API Token** from the dashboard
4. The free tier covers the FIFA World Cup (competition code: `WC`)
   - Rate limit: 10 requests / minute
   - No daily cap on free tier

---

## Step 4 — Deploy the Edge Function

### Install Supabase CLI (if not installed)
```bash
npm install -g supabase
```

### Login and link your project
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```
Your project ref is in: Supabase Dashboard → Settings → General → Reference ID

### Set the API key secret
```bash
supabase secrets set FOOTBALL_DATA_API_KEY=your_token_here
```

### Deploy the function
```bash
supabase functions deploy sync-results
```

### Test it manually
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-results \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

Or use the **"🌐 סנכרן מהאינטרנט"** button in the Admin Panel → Matches tab.

---

## Step 5 — Schedule automatic hourly sync

In Supabase Dashboard → SQL Editor:

### Enable extensions (do this once)
```sql
-- Enable pg_cron (for scheduled jobs)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net (for HTTP calls from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Store secrets in Vault
In Supabase Dashboard → Vault → Add new secret:
- Name: `edge_fn_url`  → Value: `https://YOUR_PROJECT_REF.supabase.co/functions/v1`
- Name: `edge_fn_token` → Value: your **Service Role Key** (Settings → API)

### Create the cron job
```sql
SELECT cron.schedule(
  'sync-match-results',
  '0 * * * *',   -- every hour on the hour
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets
                  WHERE name = 'edge_fn_url') || '/sync-results',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' ||
                     (SELECT decrypted_secret FROM vault.decrypted_secrets
                      WHERE name = 'edge_fn_token')
                 ),
      body    := '{"source":"cron"}'::jsonb
    );
  $$
);
```

### Verify it was created
```sql
SELECT * FROM cron.job;
```

### Remove the job (if needed)
```sql
SELECT cron.unschedule('sync-match-results');
```

---

## How the auto-sync works

1. Every hour, the cron job calls the Edge Function via HTTP POST
2. The function fetches all `FINISHED` World Cup matches from football-data.org
3. It maps English team names → Hebrew using a built-in dictionary
4. For each finished match, it finds the matching row in our `matches` table
5. Updates `result`, `status='finished'`, `home_score`, `away_score`, `last_synced_at`
6. Grades all bets for that match (`is_correct = true/false`)
7. The DB trigger `on_bet_graded` automatically recalculates each user's `total_points`
8. Writes a log entry to `sync_log` (visible in Admin Dashboard)

**Manual override always available:** admin can set/correct any result in the Matches tab.

---

## Accessing the Admin Panel

- URL: `/admin`
- Only users whose email is in the `admins` table can access it
- For admin users, a **🔐 ניהול** button appears in the header

### Admin Panel tabs:
| Tab | Features |
|-----|----------|
| 📊 סטטיסטיקות | User/bet counts, popular matches, sync log, recalculate all points |
| ⚽ משחקים | Set results, set live, lock/unlock matches, trigger sync |
| 👥 משתמשים | View all users, edit points, ban/unban, delete profile |
