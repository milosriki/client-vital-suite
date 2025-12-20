# 🔧 Supabase Database-Level Settings Setup

**Purpose**: Configure pg_cron and app settings at database level (persists across sessions)

---

## ⚠️ IMPORTANT: Permission Required

These settings require **superuser** permissions and must be run in the **Supabase Dashboard SQL Editor**, not via migrations or MCP.

---

## 🔗 Where to Run

**Supabase Dashboard**: <https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/sql/new>

---

## 📋 SQL Commands to Execute

### Step 1: Confirm Database Name

```sql
SELECT current_database() as db_name;
```

**Expected**: `postgres`

---

### Step 2: Set Supabase URL

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ztjndilxurtsfqdsvfds.supabase.co';
```

**Purpose**: Makes Supabase URL available to pg_cron jobs

---

### Step 3: Set pg_cron Secret

```sql
ALTER DATABASE postgres SET app.cron_secret = '152bd25836768729ac62122db53ad38c0d7b1d68621e8d86b4133f0521872117';
```

**Purpose**: Secret key for pg_cron authentication

**Security Note**: This secret was generated with `openssl rand -hex 32`. Keep it secure!

**To generate a new secret**:

```bash
openssl rand -hex 32
```

---

### Step 4: Verify Settings

**Important**: Open a **NEW SQL editor tab** or **reconnect** before verifying (settings apply to new sessions).

```sql
SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url,
  CASE 
    WHEN current_setting('app.cron_secret', true) IS NOT NULL 
    THEN 'SET (hidden for security)'
    ELSE 'NOT SET'
  END as cron_secret_status;
```

**Expected Output**:

```
supabase_url                                    | cron_secret_status
------------------------------------------------|-------------------
https://ztjndilxurtsfqdsvfds.supabase.co      | SET (hidden for security)
```

---

## 📁 Migration File

A migration file has been created at:
`supabase/migrations/20250120000001_set_database_settings.sql`

**Note**: This file is for reference only. Database-level `ALTER DATABASE` commands cannot be run via regular migrations - they must be executed in the Supabase Dashboard SQL Editor.

---

## ✅ Verification Checklist

- [ ] Database name confirmed: `postgres`
- [ ] `app.settings.supabase_url` set successfully
- [ ] `app.cron_secret` set successfully
- [ ] Verified in new SQL session (settings persist)

---

## 🔐 Security Notes

- `app.cron_secret` is sensitive - keep it secure
- Database-level settings persist across all sessions
- Only superuser can modify these settings
- Settings apply to new connections (reconnect to see changes)

---

## 🚀 Next Steps

After setting these:

1. Verify pg_cron jobs can access Supabase URL
2. Test cron job execution
3. Monitor cron logs for authentication issues

---

## 📝 Generated Secret

**Cron Secret**: `152bd25836768729ac62122db53ad38c0d7b1d68621e8d86b4133f0521872117`

**Generated**: 2025-01-20  
**Method**: `openssl rand -hex 32`

**To regenerate**:

```bash
openssl rand -hex 32
```
