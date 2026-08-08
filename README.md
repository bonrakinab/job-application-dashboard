# Job Application Dashboard

[![CI](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml)

A private, human-in-the-loop job intelligence system for discovering public job postings, filtering hard eligibility constraints, ranking opportunities, preparing truthful application materials, researching companies/hiring teams, and tracking outcomes.

## What is implemented

- **Next.js 16 dashboard** with job review, applications funnel, settings and password gate.
- **Supabase/Postgres persistence** for profile, public ATS sources, jobs, matches, application status, generated documents, company intelligence and activity logs.
- **Public job discovery** from Greenhouse, Lever and Ashby. No LinkedIn login or account scraping is required.
- **Deterministic prefilter** for target role families, preferred locations, seniority, explicit citizenship/clearance requirements and large stated experience gaps.
- **OpenAI structured analysis** using the Responses API. Defaults to `gpt-5.6-luna` for high-volume job analysis and `gpt-5.6-terra` for application packs/research.
- **Truth-constrained application pack** with tailored resume content, cover letter, outreach draft, interview themes and a claims audit. Known skill/employer/project identities are post-filtered against the master profile.
- **ATS-friendly PDF generation** for tailored resumes and cover letters, generated server-side on demand.
- **Company/hiring-team research** using OpenAI web search, limited to public sources. It never guesses private emails or phone numbers.
- **Gmail integration** for daily digests and draft-only outreach. Recruiter outreach is never auto-sent.
- **Vercel Cron** for a daily discovery/analysis/digest run.
- **Human approval** remains between preparation and the official application page. This project intentionally does not auto-submit job applications.

## Runtime architecture

```text
Vercel / Next.js
   ├─ Public ATS APIs: Ashby, Lever, Greenhouse
   ├─ OpenAI Responses API
   ├─ Gmail API (OAuth; optional)
   └─ Supabase Data REST API
          └─ PostgreSQL + RLS
```

## Setup

1. Create a Supabase project and run [`database/schema.sql`](database/schema.sql) in the SQL editor.
2. Deploy this repository to Vercel.
3. Copy the keys from [`.env.example`](.env.example) into Vercel Environment Variables. Do **not** commit real values.
4. At minimum for persistent operation configure:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)
   - `DASHBOARD_PASSWORD`
   - `AUTH_SECRET`
   - `CRON_SECRET`
5. Add `OPENAI_API_KEY` to enable AI analysis, company research, and application packs.
6. Optionally configure Gmail OAuth values and `GMAIL_DIGEST_TO` for daily email and outreach drafts.
7. Open **Settings** and replace the generic candidate profile with your private master profile.

## Safety / privacy defaults

- `.env` and `.env.local` are gitignored.
- Supabase tables have RLS enabled and the browser never receives the server secret key.
- When private Supabase data is configured in production, the proxy fails closed unless dashboard authentication is also configured.
- Contact research is public-source-only and does not infer email patterns.
- Generated claims are constrained by the candidate profile; job requirements not present in the profile stay gaps.
- Applications and outreach require human review.

## Public ATS sources

The schema seeds a Canada/Ontario-oriented starter set (Cohere, Ashby, Magical, Terminal, Runbook, StackAdapt, Maple, Wealthsimple, APPLY and Clutch). Sources can be added from **Settings** without changing code. You can also use the comma-separated `GREENHOUSE_BOARDS`, `LEVER_SITES`, and `ASHBY_BOARDS` env vars.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

The app falls back to non-persistent demo data when Supabase is absent, so the UI can render before credentials are configured.
