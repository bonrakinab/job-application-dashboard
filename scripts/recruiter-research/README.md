# Ontario recruitment directory audit

The directory is a research aid, not an exhaustive census or a verified list of currently open roles.

The October 31, 2026 update preserves all 326 prior contact IDs and identities. It removes unsupported personal tags, adds seven named IT Connex recruiters from official biographies, and adds 455 Ontario-based directory leads from the seven public Ontario province pages of Recruiters Bidding for Business. Known trading-name duplicates were consolidated. National-directory contacts explicitly located outside Ontario were excluded from the additions, as were obvious internal finance/office support roles.

Each contact has an audit result, reviewed URLs, limitations and zero or more `domainEvidence` records. Allowed evidence bases:

- Attributed hiring activity: an identifiable person's job advertisement or recruitment activity. This is not a completed placement.
- Stated personal specialization: a named personal specialty or recruiting-practice field. This is not a verified history of hiring.
- Self-reported recruitment history: a personal biography describes past recruiting or placement work. This is not independent verification of completed placements.

Agency services, client industries, internal job duties and recruiting certifications alone cannot establish a person's functional hiring domains. Unknown domains remain empty. Each supported domain includes a candidate-specific relevance explanation and seniority, product or contract limitations. There are no independently verified completed placements in this dataset.

Directory profiles may be unclaimed. New directory-only identities explicitly require employment confirmation. A name appearing on an agency homepage corroborates only that name association; it does not verify the exact directory title or a hiring specialty. Failed official-site lookups are retained in the reviewed-source log. Full signed-in LinkedIn histories were unavailable. Ontario's licence register returned a connection error, so licence reconciliation remains incomplete.

`audit-domains.py` takes an audit source-cache directory and the official team-page cache as arguments. It deliberately clears unsupported tags. Additional directory import and identity corroboration were performed against the separately cached source pages; do not run an audit against an incomplete cache and present it as a full re-verification. Check `src/data/recruiters.json` for the final review provenance and coverage counts.

Validation includes stable contact IDs, supplier contact classification, domain-to-evidence integrity, explicit unknowns, posting-versus-placement distinctions, private API protection, and a production Next.js build. Outreach history remains in the existing server-backed pipeline and is not rewritten by this update.
