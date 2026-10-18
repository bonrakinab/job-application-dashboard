import { JobsNav } from '@/components/JobsNav';
import { StatusPill } from '@/components/StatusPill';
import { filterFortune500Companies } from '@/lib/fortune500';
import { listFortune500CatalogPage } from '@/lib/fortune500-jobs-store';
import { getCandidateProfile, listCompanyWatchlist } from '@/lib/store';
import { rankTargetCompanyJobs } from '@/lib/target-company-jobs';

export const dynamic = 'force-dynamic';

function positiveInt(value?: string, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function stageLabel(stage: string) {
  if (stage === 'new-grad') return 'New grad';
  if (stage === 'entry-level') return 'Entry level';
  if (stage === 'internship') return 'Internship';
  return 'Experienced';
}

function sourcePostedLabel(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const value = (raw as Record<string, unknown>).source_posted_label;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dateLabel(job: { postedAt?: string; raw?: unknown }) {
  if (job.postedAt) {
    const date = new Date(job.postedAt);
    if (!Number.isNaN(date.getTime())) {
      return `Posted ${date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    }
  }
  const sourceLabel = sourcePostedLabel(job.raw);
  return sourceLabel ? `Employer source: ${sourceLabel}` : 'Posting date unavailable';
}

function hrefFor(page: number, company: string, query: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (company && company !== 'all') params.set('company', company);
  if (query) params.set('q', query);
  const qs = params.toString();
  return qs ? `/target-jobs?${qs}` : '/target-jobs';
}

function LoadFailure() {
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Fortune 500 jobs</h1>
        <div className="sub">These jobs are temporarily unavailable.</div>
      </div>
      <div className="row"><a className="btn ghost" href="/companies">Fortune 500 companies →</a></div>
    </div>
    <JobsNav />
    <div className="notice">Please refresh this page in a moment.</div>
    <a className="btn primary" href="/target-jobs">Try again</a>
  </>;
}

export default async function TargetCompanyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const company = params.company?.trim() || 'all';
  const query = params.q?.trim() || '';
  const requestedPage = positiveInt(params.page, 1);

  try {
    const [catalog, profile, watchlist] = await Promise.all([
      listFortune500CatalogPage({ page: requestedPage, pageSize: 100, company, query }),
      getCandidateProfile(),
      listCompanyWatchlist(),
    ]);
    const fortune500Companies = filterFortune500Companies(watchlist);
    const ranked = rankTargetCompanyJobs(catalog.jobs, fortune500Companies, profile);
    const byId = new Map(ranked.map((item) => [item.job.id, item]));
    const items = catalog.jobs.map((job) => byId.get(job.id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    const start = catalog.total ? (catalog.page - 1) * catalog.pageSize + 1 : 0;
    const end = Math.min(catalog.page * catalog.pageSize, catalog.total);

    return <>
      <div className="topbar">
        <div>
          <h1 className="title">Fortune 500 jobs</h1>
          <div className="sub">The full current-opening catalog collected from Fortune 500 employer career sources. Results are server-paginated, so the catalog is not truncated when it grows.</div>
        </div>
        <div className="row">
          <a className="btn ghost" href="/companies">Fortune 500 companies</a>
        </div>
      </div>

      <JobsNav />
      <div className="section-head"><h2>{catalog.total.toLocaleString()} current openings</h2></div>

      <form className="primary-search" action="/target-jobs" method="get">
        <input
          className="input"
          aria-label="Search Fortune 500 jobs"
          name="q"
          placeholder="Search title, company, or location…"
          defaultValue={query}
        />
        <select className="select" aria-label="Company" name="company" defaultValue={company}>
          <option value="all">All Fortune 500 companies</option>
          {fortune500Companies.map((value) => <option value={value.company} key={value.company}>{value.company}</option>)}
        </select>
        <button className="btn primary" type="submit">Search</button>
        {(query || company !== 'all') ? <a className="btn ghost" href="/target-jobs">Clear</a> : null}
      </form>

      <div className="result-line">
        <span className="small muted">
          Showing {start.toLocaleString()}–{end.toLocaleString()} of {catalog.total.toLocaleString()} · newest employer postings first
        </span>
        <span className="small muted">Page {catalog.page} of {catalog.pageCount}</span>
      </div>

      <div className="recommendation-grid simple-job-cards">
        {items.map((item) => <article className="card simple-job-card" key={item.job.id}>
          <div>
            <h3>{item.job.title}</h3>
            <div className="simple-job-meta">{item.watchedCompany} · {item.job.location || 'Location not listed'} · {stageLabel(item.stage)}</div>
            <div className="small muted">{dateLabel(item.job)}</div>
            <div className="tag-list">
              <StatusPill value={item.match.recommendation} />
              {item.highlySuitable ? <span className="tag">Strong fit</span> : null}
            </div>
          </div>
          <div className="simple-job-score">
            <b>{item.match.overall}</b>
            <span>match</span>
          </div>
          <div className="row recommendation-actions">
            <span className="small muted">{item.reasons[1] || item.reasons[0] || 'Current Fortune 500 opening.'}</span>
            <a className="btn ghost" href={`/jobs/${item.job.id}`}>Details</a>
            <a className="btn primary" href={item.job.applyUrl || item.job.url} target="_blank" rel="noreferrer">Employer posting ↗</a>
          </div>
        </article>)}
      </div>

      {!items.length ? <div className="notice">No current openings match these filters. Clear the search to return to the complete catalog.</div> : null}

      {catalog.pageCount > 1 ? <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
        {catalog.page > 1
          ? <a className="btn ghost" href={hrefFor(catalog.page - 1, company, query)}>← Previous</a>
          : <span className="btn ghost" aria-disabled="true">← Previous</span>}
        <span className="small muted">Page {catalog.page} of {catalog.pageCount}</span>
        {catalog.page < catalog.pageCount
          ? <a className="btn ghost" href={hrefFor(catalog.page + 1, company, query)}>Next →</a>
          : <span className="btn ghost" aria-disabled="true">Next →</span>}
      </div> : null}
    </>;
  } catch (error) {
    console.error('target-jobs render failed after database retries', error);
    return <LoadFailure />;
  }
}
