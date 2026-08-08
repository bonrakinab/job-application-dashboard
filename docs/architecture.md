# Architecture

## Pipeline

```text
Public ATS sources
  → normalization + stable job IDs
  → target-role/location/freshness filter
  → deterministic hard blockers
  → selected AI provider structured fit analysis
  → Supabase persistence
  → review queue
  → application pack / grounded company research on demand
  → official employer application page
  → application status + outcome analytics
```

## Trust boundaries

- **GitHub:** code and empty configuration templates only.
- **Vercel:** runtime and encrypted environment variables.
- **Supabase:** persistent private candidate/job/application data; accessed server-side through a secret key.
- **Gemini:** default AI provider for structured analysis and application-pack generation. Receives the job and a contact-stripped candidate profile. Interactions requests use `store=false`.
- **OpenAI:** optional paid provider. Receives the same contact-stripped profile when explicitly selected; also powers grounded company research in the current implementation.
- **Gmail:** OAuth refresh token is server-only. Automated daily digest may send; recruiter outreach is draft-only.
- **ATS sources:** public Greenhouse/Lever/Ashby posting feeds; no LinkedIn account automation.

## Cost controls

- deterministic filtering runs before AI;
- only unanalyzed relevant jobs are sent to AI;
- `MAX_ANALYSES_PER_RUN` defaults to 12;
- `ANALYSIS_CONCURRENCY` defaults to 3;
- `AI_PROVIDER` defaults to Gemini and does not silently fall back to OpenAI;
- Gemini analysis/application packs default to `gemini-3.6-flash`, which supports a free API tier;
- grounded company research remains an explicit action and is disabled in Gemini free-tier mode.

## Data integrity

Jobs use a deterministic SHA-256-derived ID from `source + board/site + external posting ID`. Re-discovery updates `last_seen_at` but preserves the original `discovered_at`. Application rows are inserted with conflict-ignore semantics so discovery can never reset an existing application status.
