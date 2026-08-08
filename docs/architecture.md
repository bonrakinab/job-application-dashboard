# Job Agent architecture

## Phase 1

1. **Discovery** — adapters fetch recent jobs from public ATS/company sources; Apify is optional.
2. **Normalization/deduplication** — canonical fields + stable job hash; existing hashes stop processing.
3. **Deterministic prefilter** — reject obvious experience/location/hard-requirement mismatches before LLM use.
4. **AI analysis** — structured job requirements and candidate match; results stored in `job_matches`.
5. **Recommendation dashboard** — only eligible jobs above threshold appear in the review queue.
6. **Human decision** — review/apply/skip; no automatic submission.
7. **Outcome tracking** — application lifecycle is stored for later conversion analytics.

## Later phases

- Application-pack generator (resume + cover letter + interview brief).
- Company/contact intelligence.
- Gmail digest and outreach drafts.
- Feedback model using actual interview/application outcomes.

## Trust boundaries

- Browser receives only the Supabase public/anon key.
- Service-role Supabase key, OpenAI key, Gmail tokens, and optional Apify token stay server-side only.
- `.env.local` is gitignored.
- Generated resume content is constrained by canonical-profile facts.
