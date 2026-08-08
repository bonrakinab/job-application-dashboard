# Architecture

## Pipeline

```text
Public ATS sources
  → normalization + stable job IDs
  → target-role/location/freshness filter
  → deterministic hard blockers
  → OpenAI structured fit analysis
  → Supabase persistence
  → review queue
  → application pack / company research on demand
  → official employer application page
  → application status + outcome analytics
```

## Trust boundaries

- **GitHub:** code and empty configuration templates only.
- **Vercel:** runtime and encrypted environment variables.
- **Supabase:** persistent private candidate/job/application data; accessed server-side through a secret key.
- **OpenAI:** receives the job and a contact-stripped candidate profile for analysis/generation.
- **Gmail:** OAuth refresh token is server-only. Automated daily digest may send; recruiter outreach is draft-only.
- **ATS sources:** public Greenhouse/Lever/Ashby posting feeds; no LinkedIn account automation.

## Cost controls

- deterministic filtering runs before OpenAI;
- only unanalyzed relevant jobs are sent to AI;
- `MAX_ANALYSES_PER_RUN` defaults to 12;
- `ANALYSIS_CONCURRENCY` defaults to 3;
- high-volume analysis defaults to GPT-5.6 Luna;
- higher-cost company research and application packs run only on explicit user action.

## Data integrity

Jobs use a deterministic SHA-256-derived ID from `source + board/site + external posting ID`. Re-discovery updates `last_seen_at` but preserves the original `discovered_at`. Application rows are inserted with conflict-ignore semantics so discovery can never reset an existing application status.
