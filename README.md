# Job Application Dashboard

[![CI](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml)

A private, human-in-the-loop job intelligence system for discovering public job postings, filtering hard eligibility constraints, ranking opportunities, preparing truthful application materials, researching companies/hiring teams, and tracking outcomes.

## What is implemented

- **Next.js 16 dashboard** with job review, applications funnel, settings and password gate.
- **Supabase/Postgres persistence** for profile, public ATS sources, jobs, matches, application status, generated documents, company intelligence and activity logs.
- **Public job discovery** from Greenhouse, Lever and Ashby. No LinkedIn login or account scraping is required.
- **Scheduled discovery** through a JWT-protected Supabase Edge Function invoked by pg_cron using Vault-backed credentials.
- **Deterministic prefilter/scoring** for target role families, skill evidence, preferred locations, seniority, explicit citizenship/clearance requirements and large stated experience gaps.
- **Gemini-first structured AI analysis** through the Gemini Interactions API. `gemini-3.6-flash` is the default model and can run on the Gemini API free tier.
- **Optional OpenAI provider** remains available by explicitly setting `AI_PROVIDER=openai`.
- **Truth-constrained application pack** with tailored resume content, cover letter, outreach draft, interview themes and a claims audit. Known skill/employer/project identities are post-filtered against the master profile.
- **ATS-friendly PDF generation** for tailored resumes and cover letters, generated server-side on demand.
- **Company/hiring-team web research** remains available with the OpenAI provider. It is intentionally disabled in the Gemini free-tier configuration because Google Search grounding is not included on that tier.
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
   ├─ Gemini 3.6 Flash (default/free AI enrichment)
   ├─ OpenAI API (optional paid provider / grounded research)
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
6. For free AI enrichment configure:
   - `AI_PROVIDER=gemini`
   - `GEMINI_API_KEY`
   The default analysis/application-pack model is `gemini-3.6-flash`.
7. If you explicitly want the paid OpenAI provider instead, set `AI_PROVIDER=openai` and configure `OPENAI_API_KEY`.
8. Optionally configure Gmail OAuth values and `GMAIL_DIGEST_TO` for daily email and outreach drafts.
9. Save the private master candidate profile through **Settings** rather than committing it to Git.

See [`docs/deployment.md`](docs/deployment.md) for the production checklist and `/api/health` diagnostics.

## AI privacy and cost defaults

- Gemini requests use `store=false` so the app does not ask the Interactions API to retain the interaction for server-side history.
- Email, phone number and personal links are removed from the candidate profile before it is sent to either AI provider.
- `AI_PROVIDER` defaults to Gemini. The app does **not** silently fall back to OpenAI if Gemini is unavailable, preventing unexpected paid API usage.
- Deterministic blockers run before AI calls, reducing unnecessary model requests.
- Company web research is not attempted through Gemini free-tier mode because search grounding is not available there.

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
