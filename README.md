# Job Application Dashboard

[![CI](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml)

A private, human-in-the-loop job intelligence system for discovering public job postings, filtering hard eligibility constraints, ranking opportunities, preparing truthful application materials, researching companies/hiring teams, and tracking outcomes.

## What is implemented

- **Next.js 16 dashboard** with job review, applications funnel, settings and password gate.
- **Supabase/Postgres persistence** for profile, public ATS sources, jobs, matches, application status, generated documents, company intelligence and activity logs.
- **Public job discovery** from Greenhouse, Lever and Ashby. No LinkedIn login or account scraping is required.
- **Scheduled discovery** through a JWT-protected Supabase Edge Function invoked by pg_cron using Vault-backed credentials.
- **Deterministic prefilter/scoring** for target role families, skill evidence, preferred locations, seniority, explicit citizenship/clearance requirements and large stated experience gaps.
- **OpenAI structured analysis** using the Responses API when an API key is configured.
- **Truth-constrained application pack** with tailored resume content, cover letter, outreach draft, interview themes and a claims audit. Known skill/employer/project identities are post-filtered against the master profile.
- **ATS-friendly PDF generation** for tailored resumes and cover letters, generated server-side on demand.
- **Company/hiring-team research** using public web sources. It never guesses private emails or phone numbers.
- **Gmail integration** for daily digests and draft-only outreach. Recruiter outreach is never auto-sent.
- **Human approval** remains between preparation and the official application page. This project intentionally does not auto-submit job applications.

## Runtime architecture

```text
Supabase pg_cron
      │
      ▼
Supabase Edge Function ──► Public ATS APIs: Ashby / Lever / Greenhouse
      │
      ▼
PostgreSQL + RLS
      ▲
      │
Vercel / Next.js dashboard
   ├─ OpenAI Responses API (optional enrichment)
   └─ Gmail API (optional digest + draft outreach)
```

## Setup

For a new environment:

1. Create a Supabase project and run [`database/schema.sql`](database/schema.sql), followed by the versioned migrations in [`database/migrations/`](database/migrations/).
2. Deploy `supabase/functions/daily-discovery` and configure the Vault-backed scheduler as documented in the migration files.
3. Deploy this repository to Vercel.
4. Copy the keys from [`.env.example`](.env.example) into Vercel Environment Variables. Do **not** commit real values.
5. At minimum for persistent web operation configure:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)
   - `DASHBOARD_PASSWORD`
   - `AUTH_SECRET`
6. Add `OPENAI_API_KEY` to enable AI analysis, company research, and application packs.
7. Optionally configure Gmail OAuth values and `GMAIL_DIGEST_TO` for daily email and outreach drafts.
8. Save the private master candidate profile through **Settings** rather than committing it to Git.

See [`docs/deployment.md`](docs/deployment.md) for the production checklist and `/api/health` diagnostics.

## Safety / privacy defaults

- `.env` and `.env.local` are gitignored.
- Supabase tables have RLS enabled and the browser never receives the server secret key.
- Private tables intentionally have no browser-facing RLS policies; server-side trusted code performs persistence.
- When private Supabase data is configured in production, the proxy fails closed unless dashboard authentication is also configured.
- Contact research is public-source-only and does not infer email patterns.
- Generated claims are constrained by the candidate profile; job requirements not present in the profile stay gaps.
- Applications and outreach require human review.

## Public ATS sources

The schema seeds a Canada/Ontario-oriented starter set including Cohere, Ashby, Magical, Terminal, Runbook, StackAdapt, Maple, Wealthsimple, APPLY and Clutch. Sources can be added or disabled from **Settings** without changing code. Environment-based source overrides are also supported.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

The app falls back to non-persistent demo data when Supabase is absent, so the UI can render before credentials are configured.
