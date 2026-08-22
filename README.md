# Job Application Dashboard

[![CI](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/bonrakinab/job-application-dashboard/actions/workflows/ci.yml)

A private, human-in-the-loop job intelligence system for discovering public job postings, filtering hard eligibility constraints, ranking opportunities, preparing truthful application materials, researching companies/hiring teams, and tracking outcomes.

## What is implemented

- **Next.js 16 dashboard** with job review, applications funnel, settings and password gate.
- **Recommended Jobs + Target Company Jobs** views that rank the strongest profile-aligned roles first while retaining all discovered/eligible opportunities.
- **148-company target-employer watchlist** organized into overlapping groups such as MANG/FAANG, Magnificent Seven, Big Four, global IT/services, enterprise software/cloud, AI leaders and Canadian employer groups.
- **Supabase/Postgres persistence** for profile, public ATS sources, enterprise career sources, jobs, matches, application status, generated documents, company intelligence and activity logs.
- **Public job discovery** from Greenhouse, Lever, Ashby, Jobicy, Remotive, Remote OK and Himalayas, plus public candidate-facing Workday career endpoints and Amazon Jobs Canada. No LinkedIn/Indeed/Monster/Wellfound login or account scraping is required.
- **Four scheduled discovery workers** through JWT-protected Supabase Edge Functions invoked by pg_cron using Vault-backed credentials: hourly direct ATS, two-hour supplemental and enterprise sources, and four-hour expanded remote feeds. Direct ATS receives a half-hour boost on Tuesdays and September/October weekdays during Toronto business hours.
- **Deterministic prefilter/scoring** for target role families, skill evidence, preferred locations, seniority, explicit citizenship/clearance requirements and large stated experience gaps.
- **Gemini-first structured AI analysis** through the Gemini Interactions API. `gemini-3.6-flash` is the default model and can run on the Gemini API free tier.
- **Optional OpenAI provider** remains available by explicitly setting `AI_PROVIDER=openai`.
- **Truth-constrained application pack for every open role** with tailored resume content, cover letter, outreach draft, interview themes and a claims audit. Low-fit roles use gap-aware generation: verified projects, coursework, transferable evidence and supported JD terms are strengthened without inventing missing requirements.
- **ATS-friendly PDF generation** for tailored resumes and cover letters, generated server-side on demand.
- **Company/hiring-team web research** remains available with the OpenAI provider. It is intentionally disabled in the Gemini free-tier configuration because Google Search grounding is not included on that tier.
- **Gmail integration** for daily digests and draft-only outreach. Recruiter outreach is never auto-sent.
- **Human approval** remains between preparation and the official application page. This project intentionally does not auto-submit job applications.

## Runtime architecture

```text
Supabase pg_cron
      │
      ├── hourly ─► direct ATS discovery ─► Ashby / Lever / Greenhouse
      ├── every 2h ─► supplemental discovery ─► Jobicy / Remotive
      ├── every 4h ─► expanded remote discovery ─► Remote OK / Himalayas / WWR
      └── every 2h ─► enterprise discovery ─► Workday public careers / Amazon Jobs
                          │
                          ▼
                    PostgreSQL + RLS
                          ▲
                          │
                  Vercel / Next.js dashboard
                     ├─ profile-ranked target jobs
                     ├─ Gemini 3.6 Flash (default/free AI enrichment)
                     ├─ OpenAI API (optional paid provider / grounded research)
                     └─ Gmail API (optional digest + draft outreach)
```

The **Fresh openings** view is intentionally stricter than the full inventory: a job must have both a source-reported posting time and a first-discovery time within the same rolling 24-hour window.

## Setup

For a new environment:

1. Create a Supabase project and run [`database/schema.sql`](database/schema.sql), followed by the versioned migrations in [`database/migrations/`](database/migrations/).
2. Deploy the Edge Functions under `supabase/functions/` and configure the Vault-backed schedulers as documented in the migration files.
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
- Enterprise discovery polls public candidate-facing career endpoints conservatively; it does not authenticate to or automate LinkedIn, Indeed, Monster or Wellfound accounts.
- When private Supabase data is configured in production, the proxy fails closed unless dashboard authentication is also configured.
- Contact research is public-source-only and does not infer email patterns.
- Generated claims are constrained by the candidate profile; job requirements not present in the profile stay gaps.
- Applications and outreach require human review.

## Public job sources

The source registry supports direct company ATS boards (Greenhouse, Lever, Ashby), public supplemental job feeds, and a separate enterprise source registry for public Workday candidate sites and Amazon Jobs Canada. Target-company group cards link directly into `/target-jobs` with the corresponding company/group filter, and the job list is profile-ranked before AI enrichment.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

The app falls back to non-persistent demo data when Supabase is absent, so the UI can render before credentials are configured.

<!-- deployment retry: resume-tailoring -->
<!-- deployment retry: resume-tailoring 2026-08-09T07:24Z -->
