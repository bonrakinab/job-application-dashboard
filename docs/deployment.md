# Production deployment

The application is designed to build without secrets and run in demo mode. Real candidate/job data should only be enabled after private server-side credentials and dashboard authentication are configured.

## Required for persistent private mode

Configure these as encrypted/sensitive Vercel environment variables for Production (and Preview if desired):

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_PASSWORD`
- `AUTH_SECRET`

The application fails closed in production if Supabase private access is configured without dashboard authentication.

## AI provider

Gemini is the default provider so the core AI workflow can use the Gemini API free tier.

### Gemini (default)

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_MODEL_JOB_ANALYSIS` (default `gemini-3.6-flash`)
- `GEMINI_MODEL_APPLICATION_PACK` (default `gemini-3.6-flash`)

Gemini is used for job analysis and truth-constrained application-pack generation. Requests use the Interactions API with structured JSON output and `store=false`. Candidate email, phone number and personal links are removed before model calls.

Company/hiring-team web research is disabled in Gemini free-tier mode because Google Search grounding is not included on the free tier.

### OpenAI (optional paid provider)

To use OpenAI instead, explicitly set:

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY`
- `OPENAI_MODEL_JOB_ANALYSIS`
- `OPENAI_MODEL_APPLICATION_PACK`
- `OPENAI_MODEL_RESEARCH`

The app does not silently fail over from Gemini to OpenAI, so a Gemini quota or configuration problem cannot unexpectedly create paid OpenAI usage.

Without the selected AI provider's key, scheduled discovery still works with the deterministic scorer.

## Gmail

Outreach draft creation requires only Gmail OAuth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

The optional daily digest additionally requires:

- `GMAIL_DIGEST_TO`

Outreach remains draft-only; it is never automatically sent. `/api/health` reports Gmail OAuth and digest readiness separately without exposing any values.

## Optional Vercel Cron fallback

- `CRON_SECRET`

The production scheduler is Supabase `daily-discovery` + pg_cron. The protected Next.js cron route is retained only as a manual/fallback path.

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
4. Confirm `aiProvider` is the provider you intend to use and `checks.ai` is `true`.
5. For the free setup, confirm `aiProvider` is `gemini` and `checks.gemini` is `true`.
6. Confirm `checks.gmailOauth` is `true` before creating Gmail outreach drafts.
7. If you want the optional daily digest, also confirm `checks.gmailDigest` is `true`.
8. Sign in through `/login` and verify the dashboard loads persistent jobs.
9. Trigger one analysis/application-pack action and confirm the generated model name is saved in Supabase.

The health route only returns provider names and booleans indicating whether configuration groups are present. It never returns credential values.

## Supabase

Run the versioned migrations in `database/migrations/` after the initial schema. The scheduled `daily-discovery` Edge Function should remain JWT-protected and invoked through Vault-backed credentials. RLS is intentionally enabled without browser policies because the current web architecture accesses private tables only from trusted server-side code.
