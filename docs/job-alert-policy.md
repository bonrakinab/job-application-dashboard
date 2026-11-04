# Job alert policy

Job alert emails require live, job-specific evidence and original publication within an inclusive 72-hour window. This policy applies to the native Gmail cron digest and the separately scheduled Ontario, Windsor part-time and Rocket email automations. Existing schedules and recipients are preserved.

The native gate does not trust database discovery/last-seen times, aggregator publication dates, cached active flags, scores, or Greenhouse `updated_at`. It fetches the exact employer/ATS source again with caching disabled. It checks employer, title, job identity, Ontario eligibility, description and application evidence, closures, expiry and non-vacancy language. Source access failures, generic careers pages, JS shells, prospect posts, future vacancies, talent pools, ambiguous dates and stale postings do not qualify.

For Greenhouse, `first_published` from the job-detail API provides original publication evidence. An existing role observed before this window cannot become a new release merely through a repost. A source calendar date without timezone is assessed against conservative UTC+14 through UTC-12 bounds; those bounds are not stored as a fabricated exact timestamp. Precise timestamps require an explicit timezone. Every selected job is checked again against the cutoff immediately before composing the email, and proof expires after five minutes.

Gmail Sent history is read before sending to deduplicate against both native digests and scheduled-agent emails. An unsuccessful history check aborts sending. No-results digests and demo jobs are never emailed. A successful digest records its source URLs, original publication evidence and check times in the existing activity log.

The autonomous email tasks have corresponding strict source-verification instructions. They may use boards/search results only as leads and must exclude anything whose original date or live application cannot be verified. Broad dashboard history remains distinct from email eligibility.

This verifies publicly observable posting and application status; it does not establish an employer's private intent to hire. No test email is sent during policy validation.
