import { InterviewPrepCard } from '@/components/InterviewPrepCard';
import { JobActions } from '@/components/JobActions';
import { JobAnswerAssistant } from '@/components/JobAnswerAssistant';
import { JobDescription } from '@/components/JobDescription';
import { StatusPill } from '@/components/StatusPill';
import { applicationPackEligibility } from '@/lib/application-pack-eligibility';
import { getApplicationPackState, getCandidateProfileState } from '@/lib/application-pack-state';
import { externalApplicationProfile } from '@/lib/application-visibility';
import { scoreTailoredResumeWithCoursework } from '@/lib/ats-coursework';
import { buildInterviewPrep } from '@/lib/interview-prep';
import { projectTailoredApplicationProfile } from '@/lib/project-tailoring';
import { buildRequirementEvidenceMatrix } from '@/lib/requirement-evidence';
import { getJob } from '@/lib/store';
import type { JobValidityStatus, RequirementEvidence } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function postingState(status?: JobValidityStatus) {
  if (status === 'active') return 'Active';
  if (status === 'likely_active') return 'Likely active';
  if (status === 'closed') return 'Closed';
  if (status === 'likely_closed') return 'Likely closed';
  return 'Not verified';
}

function supportLabel(item: RequirementEvidence) {
  if (item.support === 'supported') return 'Supported';
  if (item.support === 'partial') return 'Partial';
  return 'Gap';
}

function unique(values: string[]) {
  return values.filter((value, index, list) => value && list.indexOf(value) === index);
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, profileState] = await Promise.all([getJob(id), getCandidateProfileState()]);
  if (!job) notFound();
  const packState = await getApplicationPackState(id, profileState.updatedAt);
  const pack = packState.pack;
  const match = job.match;
  const eligibility = applicationPackEligibility(match);
  const packUsable = Boolean(pack && !packState.stale);
  const applicationProfile = projectTailoredApplicationProfile(externalApplicationProfile(profileState.profile), job);
  const ats = packUsable && pack ? scoreTailoredResumeWithCoursework(job, applicationProfile, pack, match) : null;
  const requirements = pack?.requirementEvidence?.length
    ? pack.requirementEvidence
    : buildRequirementEvidenceMatrix(job, applicationProfile, match);
  const strengths = unique(match?.strengths ?? []).slice(0, 3);
  const gaps = unique([...(match?.blockers ?? []), ...(match?.gaps ?? [])]).slice(0, 4);
  const interviewPrep = buildInterviewPrep(job, packUsable && pack ? pack : null);
  const metadata = [
    job.company,
    job.location || 'Location not listed',
    job.employmentType,
    job.workplaceType,
    formatDate(job.postedAt),
  ].filter(Boolean).join(' · ');

  return <>
    <div className="topbar simple-job-header">
      <div>
        <div className="eyebrow">Job opportunity</div>
        <h1 className="title">{job.title}</h1>
        <div className="sub">{metadata}</div>
      </div>
      <div className="row job-header-actions">
        {match ? <StatusPill value={match.recommendation}/> : null}
        {job.url && job.url !== '#' ? <a className="btn ghost" target="_blank" rel="noreferrer" href={job.url}>View original ↗</a> : null}
      </div>
    </div>

    <div className="grid detail-grid simple-job-grid">
      <main className="grid" style={{ alignContent: 'start' }}>
        <section className="card">
          <div className="job-fit-heading">
            <div>
              <div className="kicker">Should I apply?</div>
              <h2>{match ? `${match.overall}/100 job match` : 'Analysis needed'}</h2>
              <p className="small muted job-fit-copy">
                {match?.explanation || 'Run the job analysis to compare this role with your verified profile.'}
              </p>
            </div>
            <div className="job-readiness">
              <span>Posting <b>{postingState(job.validityStatus)}</b></span>
              <span>Documents <b>{packUsable ? 'Ready' : pack ? 'Regenerate' : 'Not generated'}</b></span>
              {ats ? <span>Resume <b className={ats.eligibleToApply ? 'text-success' : 'text-warning'}>{ats.overall}/100</b></span> : null}
            </div>
          </div>

          {(strengths.length || gaps.length) ? <div className="fit-columns">
            <div>
              <div className="kicker">Best matches</div>
              {strengths.length ? <ul className="simple-list success-list">{strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <span className="small muted">No clear strengths identified yet.</span>}
            </div>
            <div>
              <div className="kicker">Review before applying</div>
              {gaps.length ? <ul className="simple-list gap-list">{gaps.map((item) => <li key={item}>{item}</li>)}</ul> : <span className="small muted">No major gaps identified.</span>}
            </div>
          </div> : null}
        </section>

        <section className="card">
          <div className="section-head compact-section-head">
            <div>
              <div className="kicker">Requirements</div>
              <h2>What the job needs</h2>
            </div>
            {requirements.length ? <span className="small muted">{requirements.filter((item) => item.support === 'supported').length} of {requirements.length} supported</span> : null}
          </div>
          {requirements.length ? <div className="requirement-list">
            {requirements.map((item) => <div className="requirement-row" key={`${item.importance}-${item.requirement}`}>
              <div className="requirement-copy">
                <b>{item.requirement}</b>
                <span>{item.importance === 'must-have' ? 'Required' : 'Preferred'}{item.evidence[0] ? ` · ${item.evidence[0].label}` : ''}</span>
              </div>
              <span className={`support-pill support-${item.support}`}>{supportLabel(item)}</span>
            </div>)}
          </div> : <p className="small muted">Run the analysis to extract and compare the role requirements.</p>}
          <p className="small muted requirement-note">Partial and gap items stay visible. The résumé uses transferable evidence but never invents missing qualifications.</p>
        </section>

        <details className="advanced-panel">
          <summary>Job description</summary>
          <div className="advanced-panel-body"><JobDescription description={job.description}/></div>
        </details>

        <details className="advanced-panel">
          <summary>More help: answers and interview prep</summary>
          <div className="advanced-panel-body job-help-grid">
            <JobAnswerAssistant jobId={id}/>
            <InterviewPrepCard prep={interviewPrep}/>
          </div>
        </details>
      </main>

      <aside className="grid" style={{ alignContent: 'start' }}>
        <JobActions
          id={id}
          applyUrl={job.applyUrl || job.url}
          hasPack={Boolean(pack)}
          packStale={packState.stale}
          status={job.application?.status || 'discovered'}
          canResearch={Boolean(process.env.OPENAI_API_KEY)}
          validityStatus={job.validityStatus}
          atsEligible={Boolean(ats?.eligibleToApply)}
          atsScore={ats?.overall}
          packGenerationReason={eligibility.reason}
          packGenerationBlockers={eligibility.blockers}
        />
        {packUsable && pack ? <div className="card document-status-card">
          <div className="kicker">Application documents</div>
          <h3>Résumé and cover letter ready</h3>
          <div className="document-checks">
            <span>✓ Tailored to this job</span>
            <span>✓ Verified profile evidence only</span>
            <span>{pack.claimVerification?.status === 'pass' ? '✓ Claims checked' : '△ Claims need review'}</span>
          </div>
          {pack.generationMeta?.generatedAt ? <p className="small muted">Generated {formatDate(pack.generationMeta.generatedAt)}</p> : null}
        </div> : null}
      </aside>
    </div>
  </>;
}
