import { CompanyWatchlistClient } from '@/components/CompanyWatchlistClient';
import { listCompanyWatchlist, listJobs } from '@/lib/store';
import { normalizeText } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function sameCompany(target: string, actual: string) {
  const a = normalizeText(target).replace(/\b(inc|corp|corporation|ltd|limited|canada)\b/g, '').trim();
  const b = normalizeText(actual).replace(/\b(inc|corp|corporation|ltd|limited|canada|confidential)\b/g, '').trim();
  return a === b || (a.length >= 5 && (b.startsWith(a) || a.startsWith(b)));
}

export default async function CompaniesPage() {
  const [companies, jobs] = await Promise.all([listCompanyWatchlist(), listJobs(500)]);
  const coverage = companies.map((company) => {
    const matchingJobs = jobs.filter((job) => sameCompany(company.company, job.company));
    return {
      ...company,
      jobs: matchingJobs.length,
      recommended: matchingJobs.filter((job) => job.match && ['exceptional', 'strong', 'reasonable'].includes(job.match.recommendation) && !job.match.blockers.length).length,
    };
  });
  const liveCompanies = coverage.filter((company) => company.jobs > 0).length;
  const tierOne = coverage.filter((company) => company.priority === 1).length;

  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Employer coverage</div>
        <h1 className="title">Target companies</h1>
        <div className="sub">A broad Canada-focused employer watchlist across AI, software, data, ERP, consulting, banking, telecom, insurance and industrial technology. Jobs are imported automatically where a compliant feed exists; every other employer remains one click away on its careers page and major portals.</div>
      </div>
      <a className="btn ghost" href="/recommended">Recommended jobs →</a>
    </div>

    <div className="grid recommendation-metrics">
      <div className="metric"><div className="label">Target employers</div><div className="value">{companies.length}</div></div>
      <div className="metric"><div className="label">Tier 1</div><div className="value">{tierOne}</div></div>
      <div className="metric"><div className="label">With live jobs</div><div className="value">{liveCompanies}</div></div>
      <div className="metric"><div className="label">Jobs in database</div><div className="value">{jobs.length}</div></div>
    </div>

    <div className="notice">“Watching” does not claim that we have an unrestricted private API for that employer. It means the employer is in your search universe and is surfaced through direct career/portal searches until a safe machine-readable source is available.</div>

    <CompanyWatchlistClient companies={coverage} />
  </>;
}
