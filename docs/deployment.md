# Production deployment

The application is designed to build without secrets and run in demo mode. Real candidate/job data should only be enabled after private server-side credentials and dashboard authentication are configured.

## Required for persistent private mode

Configure these as encrypted/sensitive Vercel environment variables for Production (and Preview if desired):

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_PASSWORD`
- `AUTH_SECRET`

The application fails closed in production if Supabase private access is configured without dashboard authentication.

## Optional integrations

### OpenAI

- `OPENAI_API_KEY`
- `OPENAI_MODEL_JOB_ANALYSIS` (defaults are documented in `.env.example`)
- `OPENAI_MODEL_APPLICATION_PACK`
- `OPENAI_MODEL_RESEARCH`

Without an OpenAI key, scheduled discovery still works with the deterministic scorer.

### Gmail

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GMAIL_DIGEST_TO`

Outreach remains draft-only; it is not automatically sent.

### Vercel Cron

- `CRON_SECRET`

The Supabase `daily-discovery` Edge Function and pg_cron schedule can operate independently of Vercel Cron.

## Safe secret generation

Generate high-entropy values locally for `AUTH_SECRET` and `CRON_SECRET`; do not commit or paste them into GitHub. For example:

```bash
openssl rand -base64 32
```

Use a separate human-memorable value for `DASHBOARD_PASSWORD`.

## Verification

After a fresh deployment:

1. Open `/api/health`.
2. Confirm `mode` is `persistent` after Supabase credentials are configured.
3. Confirm `dashboardAuth` is `true` before exposing private data.
4. Confirm optional integrations individually as they are enabled.
5. Sign in through `/login` and verify the dashboard loads persistent jobs.
6. Trigger one manual discovery and confirm existing application statuses are preserved.

The health route only returns booleans indicating whether configuration groups are present. It never returns credential values.

## Supabase

Run the versioned migrations in `database/migrations/` after the initial schema. The scheduled `daily-discovery` Edge Function should remain JWT-protected and invoked through Vault-backed credentials. RLS is intentionally enabled without browser policies because the current web architecture accesses private tables only from trusted server-side code.
